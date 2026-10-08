import { bindings } from "./cloudflare-env";
import { listShelf } from "./shelf-store";
import { assertTimeZone, skincareDateAt } from "@/lib/domain/skincare-day";
import { buildRota } from "@/lib/domain/scheduler";
import type { DayRecord, RotaSnapshot, RuleSet, ShelfProduct } from "@/lib/domain/types";

const NO_CLINICAL_RULES: RuleSet = {
  version: "pending-reviewed-rules-v1",
  timingRules: [],
  pairRules: [],
  contextHoldRules: [],
};

interface RotaRow {
  id: string;
  owner_user_id: string;
  create_key: string;
  snapshot_json: string;
  timezone: string;
  start_date: string;
  archived_at: string | null;
  created_at: string;
}

export function requestTimeZone(request: Request) {
  const zone = request.headers.get("x-myrota-time-zone") || "UTC";
  if (zone.length > 90) throw new Error("validation:timezone");
  try { assertTimeZone(zone); }
  catch { throw new Error("validation:timezone"); }
  return zone;
}

export async function activeRota(owner: string): Promise<RotaSnapshot | null> {
  const db = (await bindings()).DB;
  const row = await db.prepare(
    "SELECT * FROM rota_snapshots WHERE owner_user_id = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1",
  ).bind(owner).first<RotaRow>();
  return row ? JSON.parse(row.snapshot_json) as RotaSnapshot : null;
}

export async function rotaById(owner: string, id: string): Promise<RotaSnapshot | null> {
  const db = (await bindings()).DB;
  const row = await db.prepare("SELECT * FROM rota_snapshots WHERE owner_user_id = ? AND id = ?")
    .bind(owner, id).first<RotaRow>();
  return row ? JSON.parse(row.snapshot_json) as RotaSnapshot : null;
}

export async function latestRotas(owner: string, limit = 2): Promise<RotaSnapshot[]> {
  const db = (await bindings()).DB;
  const rows = await db.prepare(
    "SELECT snapshot_json FROM rota_snapshots WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).bind(owner, Math.min(limit, 14)).all<{ snapshot_json: string }>();
  return rows.results.reverse().map((r) => JSON.parse(r.snapshot_json) as RotaSnapshot);
}

export async function createRotaForUser(owner: string, input: unknown, timeZone: string) {
  const req = input as { idempotencyKey?: string; context?: Record<string, unknown> } | null;
  if (!req || typeof req.idempotencyKey !== "string" || req.idempotencyKey.length < 8 ||
      req.idempotencyKey.length > 160) throw new Error("validation:idempotency_key");
  const context = req.context ?? {};
  if (typeof context !== "object" || Array.isArray(context)) throw new Error("validation:context");
  if (context.care && !["none","prefer_not_to_say","pregnant_or_breastfeeding","prescription_treatment"].includes(String(context.care))) {
    throw new Error("validation:context");
  }
  if (context.retinoidExperience && !["new","some","long"].includes(String(context.retinoidExperience))) {
    throw new Error("validation:context");
  }
  const db = (await bindings()).DB;
  const existing = await activeRota(owner);
  if (existing) return { rota: existing, mixNote: null };
  const shelf = (await listShelf(owner)) as ShelfProduct[];
  if (!shelf.some((p) => !p.finishedAt)) throw new Error("validation:empty_shelf");
  const now = new Date().toISOString();
  const rota = buildRota({
    rotaId: crypto.randomUUID(),
    weekNumber: 1,
    startDate: skincareDateAt(now, timeZone),
    timeZone,
    createdAt: now,
    products: shelf,
    context: {
      care: context.care as "none" | "prefer_not_to_say" | "pregnant_or_breastfeeding" | "prescription_treatment" | undefined,
      retinoidExperience: context.retinoidExperience as "new" | "some" | "long" | undefined,
    },
    ruleSet: NO_CLINICAL_RULES,
  });
  // Only the derived rota snapshot is stored; user safety/health context is transient.
  try {
    await db.prepare(
      `INSERT INTO rota_snapshots
       (id, owner_user_id, create_key, snapshot_json, timezone, start_date, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).bind(rota.id, owner, req.idempotencyKey, JSON.stringify(rota), timeZone, rota.startDate, now).run();
  } catch {
    // Handles repeat taps or simultaneous saves without inventing a second rota.
    const current = await activeRota(owner);
    if (current) return { rota: current, mixNote: null };
    throw new Error("rota_insert_failed");
  }
  return { rota, mixNote: null };
}

export async function recordsForUser(owner: string, rotaIds: string[]): Promise<DayRecord[]> {
  if (!rotaIds.length) return [];
  const db = (await bindings()).DB;
  const all: DayRecord[] = [];
  for (const id of rotaIds.slice(-2)) {
    const rows = await db.prepare(
      "SELECT record_json FROM day_records WHERE owner_user_id = ? AND rota_id = ? ORDER BY skincare_date",
    ).bind(owner, id).all<{ record_json: string }>();
    all.push(...rows.results.map((x) => JSON.parse(x.record_json) as DayRecord));
  }
  return all;
}

export async function saveDayRecordWithRevision(
  owner: string, record: DayRecord, expectedRevision: number,
) {
  const db = (await bindings()).DB;
  const result = await db.prepare(
    `UPDATE day_records SET record_json = ?, revision = revision + 1, updated_at = ?
     WHERE owner_user_id = ? AND rota_id = ? AND skincare_date = ? AND revision = ?`,
  ).bind(
    JSON.stringify(record), new Date().toISOString(), owner,
    record.rotaId, record.skincareDate, expectedRevision,
  ).run();
  return (result.meta?.changes ?? 0) === 1;
}
