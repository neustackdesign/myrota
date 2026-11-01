"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createHttpRepository } from "../api/http-repository";
import type { RotaRepository } from "../api/repository";
import { loadTurnstileToken } from "./turnstile";

/**
 * The PWA always talks to the real same-origin HTTP API (proxied to the
 * Cloudflare Worker). There is no fixture repository and no browser-storage
 * fallback: failures surface as typed ApiErrors with retry.
 *
 * DEMO_MODE (NEXT_PUBLIC_MYROTA_DEMO=1 at build time) only unlocks the
 * design-review gallery at /dev/states; it never changes /app's data source.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_MYROTA_DEMO === "1";

const RuntimeContext = createContext<RotaRepository | null>(null);

export function RuntimeProvider({ children, repository }: { children: ReactNode; repository?: RotaRepository }) {
  const repo = useMemo(() => repository ?? createHttpRepository({ captchaToken: loadTurnstileToken }), [repository]);
  return <RuntimeContext.Provider value={repo}>{children}</RuntimeContext.Provider>;
}

export function useRepository(): RotaRepository {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("RuntimeProvider missing");
  return ctx;
}

/** Idempotency keys for writes. Stable per user action, so retries replay safely. */
export function newIdempotencyKey(prefix: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}:${rand}`;
}
