import { addDays, compareDates, skincareDateAt, skincareDayEnd, skincareDayStart } from "./skincare-day";
import type {
  CompletionEvent,
  CompletionSession,
  DayRecord,
  DayStatus,
  IanaTimeZone,
  ISODateTime,
  RotaSnapshot,
  SkincareDate,
} from "./types";

/**
 * Day records are the only source of truth for adherence. Streaks, Rescue and
 * Friend Streak are always DERIVED from dated records; there is no mutable
 * counter anywhere in this module.
 */

export const RESCUE_WINDOW_HOURS = 48;

/** Events that genuinely belong to this record. A mislabelled event cannot invent completion. */
function ownEvents(record: DayRecord): CompletionEvent[] {
  return record.events.filter((e) => e.rotaId === record.rotaId && e.skincareDate === record.skincareDate);
}

export function isRestDay(record: Pick<DayRecord, "scheduled">) {
  return !record.scheduled.am && !record.scheduled.pm;
}

export function sessionDone(record: DayRecord, session: CompletionSession) {
  return ownEvents(record).some((e) => e.session === session);
}

/** Qualifying day = every actually-scheduled session done, or explicit Rest check-in on a day with nothing scheduled. */
export function qualifies(record: DayRecord): boolean {
  if (isRestDay(record)) return sessionDone(record, "rest");
  return (!record.scheduled.am || sessionDone(record, "am")) && (!record.scheduled.pm || sessionDone(record, "pm"));
}

export function dayStatus(record: DayRecord, today: SkincareDate): DayStatus {
  const cmp = compareDates(record.skincareDate, today);
  if (cmp > 0) return "future";
  if (qualifies(record)) return isRestDay(record) ? "rest_complete" : "complete";
  if (cmp === 0) return "in_progress";
  if (record.rescue) return "rescued";
  return "missed";
}

/** A real, earned completion (Rescue never counts). */
export function isEarned(status: DayStatus) {
  return status === "complete" || status === "rest_complete";
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export type CompletionError =
  | "wrong_rota"
  | "wrong_date"
  | "not_scheduled"
  | "rest_not_allowed"
  | "outside_skincare_day";

export type CompletionResult =
  | { ok: true; record: DayRecord; duplicate: boolean }
  | { ok: false; error: CompletionError };

/**
 * Idempotent completion. Replaying the same idempotency key, or completing an
 * already-completed session, returns the record unchanged. No retroactive
 * completion: the event must occur inside the record's own 04:00→04:00 window.
 */
export function applyCompletion(record: DayRecord, event: CompletionEvent): CompletionResult {
  if (event.rotaId !== record.rotaId) return { ok: false, error: "wrong_rota" };
  if (event.skincareDate !== record.skincareDate) return { ok: false, error: "wrong_date" };
  if (record.events.some((e) => e.idempotencyKey === event.idempotencyKey)) {
    return { ok: true, record, duplicate: true };
  }
  if (event.session === "rest") {
    if (!isRestDay(record)) return { ok: false, error: "rest_not_allowed" };
  } else if (!record.scheduled[event.session]) {
    return { ok: false, error: "not_scheduled" };
  }
  const at = new Date(event.occurredAt).getTime();
  const start = skincareDayStart(record.skincareDate, record.timeZone).getTime();
  const end = skincareDayEnd(record.skincareDate, record.timeZone).getTime();
  if (at < start || at >= end) return { ok: false, error: "outside_skincare_day" };
  if (sessionDone(record, event.session)) return { ok: true, record, duplicate: true };
  return { ok: true, record: { ...record, events: [...record.events, event] }, duplicate: false };
}

// ---------------------------------------------------------------------------
// Rescue
// ---------------------------------------------------------------------------

export type MissStatus = "eligible" | "expired" | "rescued" | "rota_rescue_used" | "declined";

export interface MissedDay {
  skincareDate: SkincareDate;
  rotaId: string;
  timeZone: IanaTimeZone;
  /** Exactly 48h after the 04:00 rollover that ENDS the missed skincare day. */
  expiresAt: ISODateTime;
  status: MissStatus;
}

export function rescueExpiresAt(date: SkincareDate, timeZone: IanaTimeZone): Date {
  return new Date(skincareDayEnd(date, timeZone).getTime() + RESCUE_WINDOW_HOURS * 3_600_000);
}

/**
 * Every missed (or rescued) day, oldest first, with its Rescue status. A prior
 * unresolved miss is never silently dropped: it stays listed as eligible until
 * its own deadline, then becomes `expired`.
 */
export function listMisses(
  records: DayRecord[],
  rotas: Pick<RotaSnapshot, "id" | "rescueUsedFor">[],
  now: Date | ISODateTime,
): MissedDay[] {
  const nowMs = new Date(now).getTime();
  const out: MissedDay[] = [];
  for (const record of records) {
    const today = skincareDateAt(now, record.timeZone);
    const status = dayStatus(record, today);
    if (status !== "missed" && status !== "rescued") continue;
    const expiresAt = rescueExpiresAt(record.skincareDate, record.timeZone);
    const rota = rotas.find((r) => r.id === record.rotaId);
    let miss: MissStatus;
    if (status === "rescued") miss = "rescued";
    else if (record.rescueDeclinedAt) miss = "declined";
    else if (rota?.rescueUsedFor && rota.rescueUsedFor !== record.skincareDate) miss = "rota_rescue_used";
    else if (nowMs >= expiresAt.getTime()) miss = "expired";
    else miss = "eligible";
    out.push({
      skincareDate: record.skincareDate,
      rotaId: record.rotaId,
      timeZone: record.timeZone,
      expiresAt: expiresAt.toISOString(),
      status: miss,
    });
  }
  return out.sort((a, b) => compareDates(a.skincareDate, b.skincareDate));
}

export type RescueError = "not_missed" | "expired" | "rota_rescue_used" | "declined" | "unknown_rota";

export type RescueResult =
  | { ok: true; record: DayRecord; rota: RotaSnapshot; duplicate: boolean }
  | { ok: false; error: RescueError };

/**
 * One Rescue per missed rota. Marks the day `rescued` (never `completed`) and
 * spends THAT rota's Rescue, even when the user is already in the next rota.
 */
export function applyRescue(
  record: DayRecord,
  rota: RotaSnapshot,
  now: Date | ISODateTime,
  idempotencyKey: string,
): RescueResult {
  if (rota.id !== record.rotaId) return { ok: false, error: "unknown_rota" };
  if (record.rescue) {
    return { ok: true, record, rota, duplicate: true };
  }
  const today = skincareDateAt(now, record.timeZone);
  if (dayStatus(record, today) !== "missed") return { ok: false, error: "not_missed" };
  if (record.rescueDeclinedAt) return { ok: false, error: "declined" };
  if (rota.rescueUsedFor && rota.rescueUsedFor !== record.skincareDate) return { ok: false, error: "rota_rescue_used" };
  if (new Date(now).getTime() >= rescueExpiresAt(record.skincareDate, record.timeZone).getTime()) {
    return { ok: false, error: "expired" };
  }
  const at = new Date(now).toISOString();
  return {
    ok: true,
    duplicate: false,
    record: { ...record, rescue: { rescuedAt: at, idempotencyKey } },
    rota: { ...rota, rescueUsedFor: record.skincareDate },
  };
}

// ---------------------------------------------------------------------------
// Streak (continuity vs earned are never conflated)
// ---------------------------------------------------------------------------

export interface StreakSummary {
  /** Unbroken run length in days; rescued days bridge the run. Shown in the Ring centre. */
  continuity: number;
  /** Real qualifying days inside that run. Rescue never adds to this. */
  earned: number;
  /** Rescued days inside that run. */
  rescued: number;
  /** `at_risk` while a rescuable miss is pending: the streak is held and today adds nothing. */
  state: "none" | "active" | "at_risk";
  /** The pending miss holding the streak, if any. */
  heldBy: SkincareDate | null;
  todayCounted: boolean;
}

function runEndingAt(
  byDate: Map<SkincareDate, DayRecord>,
  from: SkincareDate,
  today: SkincareDate,
  overrideRescued?: SkincareDate,
) {
  let continuity = 0;
  let earned = 0;
  let rescued = 0;
  let d = from;
  for (;;) {
    const record = byDate.get(d);
    if (!record) break;
    const status = d === overrideRescued ? "rescued" : dayStatus(record, today);
    if (isEarned(status)) {
      continuity += 1;
      earned += 1;
    } else if (status === "rescued") {
      continuity += 1;
      rescued += 1;
    } else break;
    d = addDays(d, -1);
  }
  return { continuity, earned, rescued };
}

export interface StreakInput {
  records: DayRecord[];
  rotas: Pick<RotaSnapshot, "id" | "rescueUsedFor">[];
  now: Date | ISODateTime;
  timeZone: IanaTimeZone;
}

export function computeStreak(input: StreakInput, assumeRescued?: SkincareDate): StreakSummary {
  const today = skincareDateAt(input.now, input.timeZone);
  const byDate = new Map<SkincareDate, DayRecord>();
  for (const r of input.records) {
    const prev = byDate.get(r.skincareDate);
    // Two records for one date (e.g. after a merge): a real completion wins.
    if (!prev || (!qualifies(prev) && qualifies(r))) byDate.set(r.skincareDate, r);
  }
  const misses = listMisses([...byDate.values()], input.rotas, input.now).filter(
    (m) => compareDates(m.skincareDate, today) < 0 && m.skincareDate !== assumeRescued,
  );
  const pending = misses.filter((m) => m.status === "eligible").map((m) => m.skincareDate);
  const final = misses.filter((m) => m.status !== "eligible" && m.status !== "rescued").map((m) => m.skincareDate);
  const lastPending = pending.at(-1) ?? null;
  const lastFinal = final.at(-1) ?? null;

  if (lastPending && (!lastFinal || compareDates(lastPending, lastFinal) > 0)) {
    const run = runEndingAt(byDate, addDays(lastPending, -1), today, assumeRescued);
    return { ...run, state: "at_risk", heldBy: lastPending, todayCounted: false };
  }

  const todayRecord = byDate.get(today);
  const todayCounted = !!todayRecord && qualifies(todayRecord);
  const run = runEndingAt(byDate, todayCounted ? today : addDays(today, -1), today, assumeRescued);
  return { ...run, state: run.continuity > 0 ? "active" : "none", heldBy: null, todayCounted };
}

/** What the streak would be if the pending miss were rescued (for the Rescue sheet preview). */
export function streakIfRescued(input: StreakInput, missed: SkincareDate): StreakSummary {
  return computeStreak(input, missed);
}
