"use client";

import { useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-myrota-turnstile="1"]');
    const done = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load"));
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.myrotaTurnstile = "1";
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function Gate1AuthSmoke() {
  const mountRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "running" | "pass" | "fail">("idle");
  const [log, setLog] = useState<string[]>([]);

  const add = (line: string) => setLog((current) => [...current, line]);

  async function run() {
    setState("running");
    setLog([]);
    let api: TurnstileApi | null = null;
    try {
      add("1. Loading public config…");
      const config = await json<{ turnstileSiteKey: string | null }>(
        await fetch("/api/config", { cache: "no-store" }),
      );
      if (!config.turnstileSiteKey) throw new Error("Turnstile site key is not configured");

      add("2. Running real Turnstile challenge…");
      api = await loadTurnstile();
      if (!mountRef.current) throw new Error("Turnstile mount missing");

      const token = await new Promise<string>((resolve, reject) => {
        if (widgetRef.current) {
          api!.remove(widgetRef.current);
          widgetRef.current = null;
        }
        const id = api!.render(mountRef.current!, {
          sitekey: config.turnstileSiteKey,
          appearance: "interaction-only",
          execution: "execute",
          callback: (value: unknown) => typeof value === "string" ? resolve(value) : reject(new Error("Invalid Turnstile token")),
          "error-callback": () => reject(new Error("Turnstile challenge failed")),
          "expired-callback": () => reject(new Error("Turnstile token expired")),
          "timeout-callback": () => reject(new Error("Turnstile challenge timed out")),
        });
        widgetRef.current = id;
        api!.execute(id);
      });

      add("3. Creating anonymous Better Auth session…");
      await json(
        await fetch("/api/auth/sign-in/anonymous", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-captcha-response": token,
          },
          body: "{}",
        }),
      );

      add("4. Reading authenticated /api/me…");
      const me = await json<{ userId: string; isAnonymous: boolean }>(
        await fetch("/api/me", { credentials: "include", cache: "no-store" }),
      );
      if (!me.userId || me.isAnonymous !== true) {
        throw new Error("Session exists but is not the expected anonymous identity");
      }

      add("5. Writing one unknown/manual shelf record to live WEUR D1…");
      const marker = `Gate 1 ${new Date().toISOString()}`;
      const created = await json<{ product: { id: string; name: string } }>(
        await fetch("/api/shelf", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            draft: {
              brand: "myrota",
              name: marker,
              category: "other",
              format: "unknown",
              identityStatus: "unknown",
              inciStatus: "unknown",
              source: "manual",
              ingredients: [],
            },
          }),
        }),
      );

      add("6. Reading the same user's shelf back from D1…");
      const shelf = await json<{ products: Array<{ id: string; name: string }> }>(
        await fetch("/api/shelf", { credentials: "include", cache: "no-store" }),
      );
      const found = shelf.products.some((product) => product.id === created.product.id && product.name === marker);
      if (!found) throw new Error("Created shelf item was not returned to its owner");

      add(`PASS — anonymous user ${me.userId.slice(0, 8)}… persisted and read shelf item ${created.product.id.slice(0, 8)}…`);
      setState("pass");
    } catch (error) {
      add(`FAIL — ${error instanceof Error ? error.message : "Unknown error"}`);
      setState("fail");
    } finally {
      if (api && widgetRef.current) {
        try { api.reset(widgetRef.current); } catch {}
      }
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>myrota Gate 1 auth smoke</h1>
      <p style={{ lineHeight: 1.5, marginTop: 0 }}>
        Temporary infrastructure harness. It proves a real Turnstile challenge → Better Auth anonymous
        cookie → authenticated shelf write/read against the live D1 database. It creates one clearly
        labelled test Shelf record.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        style={{ minHeight: 44, padding: "0 18px", cursor: state === "running" ? "wait" : "pointer" }}
      >
        {state === "running" ? "Running…" : state === "pass" ? "Run again" : "Run live auth smoke"}
      </button>
      <div ref={mountRef} style={{ marginTop: 16, minHeight: 1 }} />
      <pre
        aria-live="polite"
        style={{ marginTop: 24, padding: 16, overflow: "auto", background: "#111", color: "#eee", lineHeight: 1.5 }}
      >
        {log.length ? log.join("\n") : "No test run yet."}
      </pre>
    </main>
  );
}
