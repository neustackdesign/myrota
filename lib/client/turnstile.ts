"use client";

/**
 * Real Turnstile verification is required only on the first meaningful write.
 * None of these timeouts bypass server verification. A blocked third-party
 * script or challenge must fail visibly and let the user retry, rather than
 * leaving the PWA on "Saving…" indefinitely.
 */
export type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationError";
  }
}

const CONFIG_TIMEOUT_MS = 10_000;
const SCRIPT_TIMEOUT_MS = 12_000;
const CHALLENGE_TIMEOUT_MS = 45_000;
const RETRY_MESSAGE = "Verification is unavailable. Check your connection or content blocker, then try saving again. Nothing was saved.";
let pendingScript: Promise<TurnstileApi> | null = null;

async function api(): Promise<TurnstileApi> {
  if (window.turnstile) return window.turnstile;
  if (!pendingScript) {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.myrotaTurnstile = "1";
    pendingScript = new Promise<TurnstileApi>((resolve, reject) => {
      const finish = (result: TurnstileApi | Error) => {
        window.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      const timer = window.setTimeout(
        () => finish(new VerificationError(RETRY_MESSAGE)),
        SCRIPT_TIMEOUT_MS,
      );
      script.onload = () => finish(
        window.turnstile ?? new VerificationError(RETRY_MESSAGE),
      );
      script.onerror = () => finish(new VerificationError(RETRY_MESSAGE));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      pendingScript = null;
      script.remove();
      throw error;
    });
  }
  return pendingScript;
}

export async function loadTurnstileToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const controller = new AbortController();
  const configTimer = window.setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  let sitekey: string | null = null;
  try {
    const res = await fetch("/api/config", { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new VerificationError(RETRY_MESSAGE);
    const config = (await res.json()) as { turnstileSiteKey?: string | null };
    sitekey = config.turnstileSiteKey ?? null;
  } catch {
    throw new VerificationError(RETRY_MESSAGE);
  } finally {
    window.clearTimeout(configTimer);
  }
  // A local harness can legitimately have no Turnstile key; the production
  // Worker still independently requires real verification for guest sign-in.
  if (!sitekey) return null;

  const turnstile = await api();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:9999";
  document.body.append(host);
  let widgetId: string | null = null;
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new VerificationError("Verification took too long. Check your connection and try saving again. Nothing was saved.")),
        CHALLENGE_TIMEOUT_MS,
      );
      const done = (result: string | Error) => {
        window.clearTimeout(timer);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      try {
        widgetId = turnstile.render(host, {
          sitekey,
          appearance: "interaction-only",
          execution: "execute",
          callback: (value: unknown) => typeof value === "string" && value.length > 0
            ? done(value)
            : done(new VerificationError("Verification failed. Please try saving again.")),
          "error-callback": (code: unknown) => {
            const safeCode = typeof code === "string" && /^\d{5,7}$/.test(code) ? ` (code ${code})` : "";
            done(new VerificationError(`Verification couldn't complete${safeCode}. Check your connection and try saving again.`));
          },
          "expired-callback": () => done(new VerificationError("Verification expired. Try saving again.")),
          "timeout-callback": () => done(new VerificationError("Verification timed out. Try saving again.")),
        });
        turnstile.execute(widgetId);
      } catch {
        done(new VerificationError(RETRY_MESSAGE));
      }
    });
  } finally {
    if (widgetId) {
      try { turnstile.remove(widgetId); } catch { /* still remove the host */ }
    }
    host.remove();
  }
}
