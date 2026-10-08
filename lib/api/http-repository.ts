import type {
  ClientConfigResponse,
  ExtractRequest,
  MeResponse,
  PatchShelfRequest,
  ProductDraft,
} from "./contract";
import { ApiError, type ApiErrorKind, type RotaRepository } from "./repository";
import type { ShelfProduct } from "../domain/types";

/**
 * Production repository: same-origin HTTPS JSON with cookie sessions.
 *
 * - No mock data, no localStorage, no silent fallback: every failure surfaces
 *   as a typed ApiError so the screen can show a real retry state.
 * - The anonymous Better Auth session is created on the FIRST meaningful write
 *   (not on page view), protected by Turnstile when a site key is configured.
 * - Never sends an owner/user ID: the server derives identity from the cookie.
 */

export interface HttpRepositoryOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Returns a Turnstile token for auth endpoints, or null when not configured. */
  captchaToken?: () => Promise<string | null>;
}

const statusKind = (status: number): ApiErrorKind =>
  status === 401
    ? "unauthorized"
    : status === 403
      ? "forbidden"
      : status === 404
        ? "not_found"
        : status === 409
          ? "conflict"
          : status === 400 || status === 422
            ? "validation"
            : status === 429
              ? "rate_limited"
              : status === 501
                ? "not_configured"
                : status === 502 || status === 503 || status === 504
                ? "unavailable"
                : "server";

export function createHttpRepository(options: HttpRepositoryOptions = {}): RotaRepository {
  const base = options.baseUrl ?? "";
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let sessionPromise: Promise<void> | null = null;
  let hasSession: boolean | null = null;

  async function request<T>(method: string, path: string, body?: unknown, init: { auth?: boolean; raw?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
    // Product day boundaries are per-user at 04:00 in the user's IANA timezone.
    if (typeof Intl !== "undefined") headers["x-myrota-time-zone"] = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    if (body !== undefined && !init.raw) headers["Content-Type"] = "application/json";
    if (init.auth && options.captchaToken) {
      const token = await options.captchaToken();
      if (token) headers["x-captcha-response"] = token;
    }
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        credentials: "same-origin",
        headers,
        body: init.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
      });
    } catch {
      throw new ApiError("network", "Network request failed");
    }
    const correlationId = res.headers.get("x-correlation-id");
    if (!res.ok) {
      let message = res.statusText;
      try {
        const data = (await res.json()) as { message?: string; error?: string };
        message = data.message ?? data.error ?? message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(statusKind(res.status), message, res.status, correlationId);
    }
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("server", "Malformed response", res.status, correlationId);
    }
  }

  /** First meaningful mutation creates the guest identity. Idempotent and de-duplicated. */
  async function ensureSession() {
    if (hasSession) return;
    if (!sessionPromise) {
      sessionPromise = (async () => {
        try {
          await request<MeResponse>("GET", "/api/me");
          hasSession = true;
        } catch (error) {
          if (!(error instanceof ApiError) || error.kind !== "unauthorized") throw error;
          await request("POST", "/api/auth/sign-in/anonymous", {}, { auth: true });
          hasSession = true;
        }
      })().finally(() => {
        sessionPromise = null;
      });
    }
    await sessionPromise;
  }

  /** A visitor without a session simply has no data yet: reads return empty, never an error. */
  async function readOrEmpty<T>(path: string, empty: () => T): Promise<T> {
    try {
      return await request<T>("GET", path);
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized" && !hasSession) return empty();
      throw error;
    }
  }

  const write = async <T>(method: string, path: string, body?: unknown) => {
    await ensureSession();
    return request<T>(method, path, body);
  };

  return {
    mode: "http",
    config: () => request<ClientConfigResponse>("GET", "/api/config"),
    me: async () => {
      try {
        const me = await request<MeResponse>("GET", "/api/me");
        hasSession = true;
        return me;
      } catch (error) {
        if (error instanceof ApiError && error.kind === "unauthorized") return null;
        throw error;
      }
    },
    updateDisplayName: (displayName) => write("PATCH", "/api/me", { displayName }),

    shelf: () => readOrEmpty("/api/shelf", () => ({ products: [] })),
    addProduct: (draft: ProductDraft) => write("POST", "/api/shelf", { draft }),
    patchProduct: async (id: string, patch: PatchShelfRequest) =>
      (await write<{ product: ShelfProduct }>("PATCH", `/api/shelf/${encodeURIComponent(id)}`, patch)).product,
    removeProduct: (id) => write("DELETE", `/api/shelf/${encodeURIComponent(id)}`),
    searchCatalogue: (q) => request("GET", `/api/catalogue?q=${encodeURIComponent(q)}`),
    extract: async (req: ExtractRequest, image?: Blob) => {
      await ensureSession();
      if (image) {
        const form = new FormData();
        form.set("method", req.method);
        form.set("side", req.side);
        form.set("image", image);
        return request("POST", "/api/extract", undefined, { raw: form });
      }
      return request("POST", "/api/extract", req);
    },

    mix: (req) => request("POST", "/api/mix", req),

    createRota: (req) => write("POST", "/api/rotas", req),
    currentRota: async () => {
      try {
        return await request("GET", "/api/rotas/current");
      } catch (error) {
        if (error instanceof ApiError && (error.kind === "not_found" || error.kind === "unauthorized")) return null;
        throw error;
      }
    },
    today: () =>
      readOrEmpty("/api/today", () => ({
        serverNow: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        rota: null,
        rotas: [],
        records: [],
        friends: [],
      })),
    complete: (req) => write("POST", "/api/completions", req),
    rescue: (rotaId, req) => write("POST", `/api/rotas/${encodeURIComponent(rotaId)}/rescue`, req),
    declineRescue: (rotaId, req) => write("POST", `/api/rotas/${encodeURIComponent(rotaId)}/rescue/decline`, req),
    swapRecovery: (rotaId, req) => write("POST", `/api/rotas/${encodeURIComponent(rotaId)}/swap-recovery`, req),
    reflect: (rotaId, req) => write("POST", `/api/rotas/${encodeURIComponent(rotaId)}/reflect`, req),
    nextRota: (req) => write("POST", "/api/rotas/next", req),

    createInvite: () => write("POST", "/api/invites", {}),
    invitePreview: (token) => request("GET", `/api/invites/${encodeURIComponent(token)}`),
    acceptInvite: (token) => write("POST", `/api/invites/${encodeURIComponent(token)}/accept`, {}),
    friends: () => readOrEmpty("/api/friends", () => ({ friends: [], inviteToken: null })),
    markFriendSeen: (pairId) => write("POST", `/api/friends/${encodeURIComponent(pairId)}/seen`, {}),

    share: (req) => write("POST", "/api/share", req),
    reminders: () => request("GET", "/api/reminders"),
    putReminders: (req) => write("PUT", "/api/reminders", req),

    startGoogleClaim: async (callbackPath) => {
      await ensureSession();
      const res = await request<{ url?: string }>("POST", "/api/auth/sign-in/social", { provider: "google", callbackURL: callbackPath }, { auth: true });
      if (!res.url) throw new ApiError("server", "Google sign-in did not return a redirect");
      return { url: res.url };
    },
    sendEmailCode: async (email, displayName) => {
      await ensureSession();
      if (displayName) await request("PATCH", "/api/me", { displayName });
      await request("POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" }, { auth: true });
    },
    verifyEmailCode: async (email, code) => {
      await request("POST", "/api/auth/sign-in/email-otp", { email, otp: code }, { auth: true });
    },
    claimStatus: () => request("GET", "/api/account/claim-status"),
  };
}
