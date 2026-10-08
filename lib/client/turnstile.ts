"use client";

/**
 * Cloudflare Turnstile for auth endpoints (anonymous sign-in, OTP send,
 * social sign-in). Only active when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the
 * server performs the real verification. Returns null when not configured.
 */
type TurnstileApi = {
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

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
let scriptPromise: Promise<void> | null = null;

function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export async function loadTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined") return null;
  await loadScript();
  const api = window.turnstile;
  if (!api) return null;
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.bottom = "0";
  host.style.right = "0";
  document.body.appendChild(host);
  try {
    return await new Promise<string>((resolve, reject) => {
      const id = api.render(host, {
        sitekey: SITE_KEY,
        size: "invisible",
        callback: (token: string) => resolve(token),
        "error-callback": () => reject(new Error("Verification failed")),
      });
      api.execute(id);
    });
  } finally {
    host.remove();
  }
}
