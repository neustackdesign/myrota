import type { D1Database } from "@cloudflare/workers-types";

/** Minimal Workers AI binding surface we rely on (provider-neutral run()). */
export interface WorkersAi {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface MyrotaBindings {
  DB: D1Database;
  /** Workers AI binding for vision/OCR extraction. Absent until provisioned + verified. */
  AI?: WorkersAi;
  /** Server gate: "1" only after the 30-label benchmark passes on the deployed model. */
  PHOTO_READING_ENABLED?: string;
  /** Override the Workers AI vision model id without redeploying code. */
  MYROTA_VISION_MODEL?: string;
  /** Override the vision input format: simple | messages | messages-array. */
  MYROTA_VISION_FORMAT?: string;
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
