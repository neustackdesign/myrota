import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceExtractQuota, EXTRACT_LIMITS } from "../../lib/server/extract-quota";

// Minimal in-memory D1 stub supporting the upsert-RETURNING used by the quota.
function fakeDb() {
  const counts = new Map<string, number>();
  return {
    _counts: counts,
    prepare(_sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt; },
        async first<T>() {
          const key = `${args[0]}|${args[1]}`;
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return { count: next } as unknown as T;
        },
      };
      return stmt;
    },
  };
}

test("per-IP cap blocks after the limit; a capped request is rejected", async () => {
  const db = fakeDb() as never;
  let lastAllowed = true;
  for (let i = 0; i < EXTRACT_LIMITS.ip + 2; i++) {
    const r = await enforceExtractQuota(db, "1.2.3.4", null);
    lastAllowed = r.allowed;
    if (i < EXTRACT_LIMITS.ip) assert.ok(r.allowed, `request ${i + 1} should pass`);
  }
  assert.equal(lastAllowed, false);
});

test("global ceiling blocks even across different IPs", async () => {
  const db = fakeDb() as never;
  let blocked = false;
  for (let i = 0; i < EXTRACT_LIMITS.global + 5; i++) {
    // unique IP each time so per-IP never trips — only the global cap can
    const r = await enforceExtractQuota(db, `10.0.${i >> 8}.${i & 255}`, null);
    if (!r.allowed) { blocked = r.reason === "global_cap"; break; }
  }
  assert.ok(blocked, "global cap must stop a distributed burst");
});

test("signed-in user gets a per-user cap", async () => {
  const db = fakeDb() as never;
  let reason: string | undefined;
  for (let i = 0; i < EXTRACT_LIMITS.user + 2; i++) {
    const r = await enforceExtractQuota(db, "9.9.9.9", "user-A");
    if (!r.allowed) { reason = r.reason; break; }
  }
  // ip cap (30) > user cap (25) so user_cap trips first for a single user+ip
  assert.equal(reason, "user_cap");
});
