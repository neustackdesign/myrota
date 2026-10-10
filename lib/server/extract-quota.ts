import type { D1Database } from "@cloudflare/workers-types";

/**
 * Abuse + cost protection for the paid /api/extract Workers-AI endpoint.
 *
 * Daily counters in D1 (one upsert per bucket). Checked BEFORE any AI call, so a
 * rejected request costs nothing. Order matters: per-IP is checked first so a
 * single IP can only contribute its own IP cap to the global ceiling; the global
 * cap is the hard cost backstop against a distributed burst.
 *
 * Tunable via bindings; conservative defaults keep well inside Workers AI free
 * neurons/day while leaving real usage (a handful of scans per person) untouched.
 */
export const EXTRACT_LIMITS = { ip: 30, user: 25, global: 300 } as const;

export type QuotaReason = "ip_cap" | "user_cap" | "global_cap";
export interface QuotaResult { allowed: boolean; reason?: QuotaReason; }

function limitsFrom(env: { EXTRACT_IP_CAP?: string; EXTRACT_USER_CAP?: string; EXTRACT_GLOBAL_CAP?: string }) {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    ip: n(env.EXTRACT_IP_CAP, EXTRACT_LIMITS.ip),
    user: n(env.EXTRACT_USER_CAP, EXTRACT_LIMITS.user),
    global: n(env.EXTRACT_GLOBAL_CAP, EXTRACT_LIMITS.global),
  };
}

async function bump(db: D1Database, bucket: string, day: string): Promise<number> {
  const row = await db.prepare(
    "INSERT INTO extract_usage (bucket, day, count) VALUES (?, ?, 1) ON CONFLICT(bucket, day) DO UPDATE SET count = count + 1 RETURNING count",
  ).bind(bucket, day).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function enforceExtractQuota(
  db: D1Database,
  ip: string | null,
  userId: string | null,
  env: { EXTRACT_IP_CAP?: string; EXTRACT_USER_CAP?: string; EXTRACT_GLOBAL_CAP?: string } = {},
): Promise<QuotaResult> {
  const day = new Date().toISOString().slice(0, 10);
  const limits = limitsFrom(env);
  const checks: Array<[string, number, QuotaReason]> = [[`ip:${ip ?? "unknown"}`, limits.ip, "ip_cap"]];
  if (userId) checks.push([`user:${userId}`, limits.user, "user_cap"]);
  checks.push(["global", limits.global, "global_cap"]);

  for (const [bucket, limit, reason] of checks) {
    const count = await bump(db, bucket, day);
    if (count > limit) {
      // Alert signal (no PII): a tagged line a wrangler-tail / log drain can watch.
      console.error("[myrota.extract.quota]", JSON.stringify({ reason, day, limit, count, kind: bucket.split(":")[0] }));
      return { allowed: false, reason };
    }
  }
  return { allowed: true };
}
