import { currentUser } from "@/lib/server/session";
import { rotaById, saveDayRecordWithRevision } from "@/lib/server/rota-store";
import { bindings } from "@/lib/server/cloudflare-env";
import { applyCompletion } from "@/lib/domain/records";
import { recordsForRota } from "@/lib/domain/week";
import type { DayRecord, CompletionSession } from "@/lib/domain/types";

interface RecordRow { record_json: string; revision: number }

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => null) as {
      rotaId?: string; skincareDate?: string; session?: CompletionSession; idempotencyKey?: string
    } | null;
    if (!body || typeof body.rotaId !== "string" || typeof body.skincareDate !== "string" ||
      !["am","pm","rest"].includes(body.session ?? "") ||
      typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 160) {
      return Response.json({ error: "Invalid completion" }, { status: 422 });
    }
    const rota = await rotaById(user.id, body.rotaId);
    if (!rota) return Response.json({ error: "Rota not found" }, { status: 404 });
    const planned = recordsForRota(rota, []).find((r) => r.skincareDate === body.skincareDate);
    if (!planned) return Response.json({ error: "Date is not in this rota" }, { status: 422 });
    const db = (await bindings()).DB;
    // A unique owner/rota/day constraint prevents multiple records for one day.
    await db.prepare(
      `INSERT OR IGNORE INTO day_records
       (owner_user_id, rota_id, skincare_date, record_json, revision, updated_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    ).bind(user.id, rota.id, body.skincareDate, JSON.stringify(planned), new Date().toISOString()).run();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const row = await db.prepare(
        "SELECT record_json, revision FROM day_records WHERE owner_user_id = ? AND rota_id = ? AND skincare_date = ?",
      ).bind(user.id, rota.id, body.skincareDate).first<RecordRow>();
      if (!row) throw new Error("missing_record");
      const record = JSON.parse(row.record_json) as DayRecord;
      const outcome = applyCompletion(record, {
        id: crypto.randomUUID(),
        rotaId: rota.id,
        skincareDate: body.skincareDate,
        session: body.session!,
        occurredAt: new Date().toISOString(),
        timeZone: rota.timeZone,
        idempotencyKey: body.idempotencyKey,
      });
      if (!outcome.ok) return Response.json({ error: outcome.error }, { status: 422 });
      if (outcome.duplicate || await saveDayRecordWithRevision(user.id, outcome.record, row.revision)) {
        return Response.json({ record: outcome.record }, { headers: { "cache-control": "no-store" } });
      }
    }
    return Response.json({ error: "Concurrent update — retry" }, { status: 409 });
  } catch {
    return Response.json({ error: "Completion service unavailable" }, { status: 503 });
  }
}
