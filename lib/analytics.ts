/**
 * Privacy-safe product analytics contract. Events carry only a closed set of
 * non-identifying properties: never product names, ingredients, health or
 * context answers, display names, invite tokens or user IDs.
 *
 * No third-party SDK is loaded. Events are dispatched as a DOM CustomEvent
 * (`myrota:analytics`) so a future, reviewed sink can subscribe; nothing is
 * sent off-device today.
 */
export type AnalyticsEvent =
  | "cta_start"            // landing → /app (where: hero|nav|dock|final|footer|mix|friends)
  | "app_open"             // /app shell mounted (src: landing|direct|invite|mix)
  | "onboarding_product"   // first product saved (method: paste|manual|unknown)
  | "onboarding_rota"      // rota created (productCount bucket)
  | "session_complete"     // am|pm|rest completion recorded
  | "mix_checked";         // Mix verdict class (never product names)

type Props = Record<string, string | number | boolean>;
const ALLOWED_KEYS = new Set(["where", "src", "method", "bucket", "session", "verdict"]);

export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const safe: Props = {};
  for (const [k, v] of Object.entries(props)) if (ALLOWED_KEYS.has(k)) safe[k] = v;
  try {
    window.dispatchEvent(new CustomEvent("myrota:analytics", { detail: { event, props: safe, at: Date.now() } }));
  } catch {
    /* analytics must never break the product */
  }
}

export function countBucket(n: number) {
  return n <= 1 ? "1" : n <= 3 ? "2-3" : n <= 6 ? "4-6" : "7+";
}
