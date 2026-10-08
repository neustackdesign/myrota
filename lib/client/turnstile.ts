"use client";

/**
 * Fetch the public Turnstile site key from the Worker at runtime.
 * Auth cookies remain same-origin. Tokens are one-use, issued only after
 * explicit user interaction with a meaningful write.
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let pendingScript: Promise<TurnstileApi> | null = null;
async function api(): Promise<TurnstileApi> {
  if (window.turnstile) return window.turnstile;
  if (!pendingScript) {
    pendingScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.myrotaTurnstile = "1";
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Verification unavailable"));
      script.onerror = () => reject(new Error("Verification couldn't load"));
      document.head.appendChild(script);
    }).catch((error) => {
      pendingScript = null;
      throw error;
    });
  }
  return pendingScript;
}

export async function loadTurnstileToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error("Verification configuration unavailable");
  const config = (await res.json()) as { turnstileSiteKey?: string | null };
  if (!config.turnstileSiteKey) return null;

  const turnstile = await api();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:9999";
  document.body.append(host);
  let widgetId: string | null = null;
  try {
    return await new Promise<string>((resolve, reject) => {
      widgetId = turnstile.render(host, {
        sitekey: config.turnstileSiteKey,
        appearance: "interaction-only",
        execution: "execute",
        callback: (value: unknown) => typeof value === "string" ? resolve(value) : reject(new Error("Invalid verification token")),
        "error-callback": () => reject(new Error("Verification failed. Try again.")),
        "expired-callback": () => reject(new Error("Verification expired. Try again.")),
        "timeout-callback": () => reject(new Error("Verification timed out. Try again.")),
      });
      turnstile.execute(widgetId);
    });
  } finally {
    if (widgetId) turnstile.remove(widgetId);
    host.remove();
  }
}
