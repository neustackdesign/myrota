import type { D1Database } from "@cloudflare/workers-types";

export interface MyrotaBindings {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  MYROTA_BASE_URL?: string;
  /** Comma-separated exact HTTPS origins for the Vercel UI preview. No wildcard trust. */
  MYROTA_TRUSTED_ORIGINS?: string;
}

/**
 * Vinext/Workers server-only binding access. Cloudflare recommends
 * cloudflare:workers for Next route handlers, server components and actions.
 */
export async function bindings(): Promise<MyrotaBindings> {
  // Lazy import keeps native Next.js builds from evaluating the Workers-only
  // virtual module during route metadata collection. Vinext resolves it in workerd.
  const mod = await import("cloudflare:workers");
  return mod.env as unknown as MyrotaBindings;
}
