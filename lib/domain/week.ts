import { buildRota, type BuildRotaInput } from "./scheduler";
import { addDays, compareDates, skincareDateAt } from "./skincare-day";
import { dayStatus, isEarned } from "./records";
import type { DayRecord, Feeling, ISODateTime, RotaSnapshot, ShelfProduct, SkincareDate } from "./types";

/**
 * Week end, archive and the next rota.
 *
 * - 7/7 "Rota complete" requires seven REAL qualifying days. A rescued day keeps
 *   continuity but is not a completion, so a rescued week is "Week ended".
 * - Archiving and starting the next week are one idempotent operation keyed by
 *   an idempotency key; replays never double-archive or create a second rota.
 * - Week two continues from the same shelf. A reflection is stored against the
 *   rota it describes and NEVER changes frequency on its own.
 */

/** Fill in records for every rota day so the UI never infers status from absence. */
export function recordsForRota(rota: RotaSnapshot, records: DayRecord[]): DayRecord[] {
  return rota.days.map((day) => {
    const found = records.find((r) => r.rotaId === rota.id && r.skincareDate === day.skincareDate);
    return (
      found ?? {
        rotaId: rota.id,
        skincareDate: day.skincareDate,
        timeZone: rota.timeZone,
        scheduled: { am: day.am.length > 0, pm: day.pm.length > 0 },
        events: [],
      }
    );
  });
}

export interface WeekSummary {
  earned: number;
  rescued: number;
  missed: number;
  /** Earned + rescued. Shown as "followed", never as "completed". */
  followed: number;
  closed: boolean;
  outcome: "rota_complete" | "week_ended" | "in_progress";
}

export function summarizeWeek(rota: RotaSnapshot, records: DayRecord[], now: Date | ISODateTime): WeekSummary {
  const today = skincareDateAt(now, rota.timeZone);
  const rs = recordsForRota(rota, records);
  const statuses = rs.map((r) => dayStatus(r, today));
  const earned = statuses.filter(isEarned).length;
  const rescued = statuses.filter((s) => s === "rescued").length;
  const missed = statuses.filter((s) => s === "missed").length;
  const lastDate = rota.days[6].skincareDate;
  const closed = compareDates(lastDate, today) < 0 || isEarned(statuses[6]);
  return {
    earned,
    rescued,
    missed,
    followed: earned + rescued,
    closed,
    outcome: !closed ? "in_progress" : earned === 7 ? "rota_complete" : "week_ended",
  };
}

export interface RotaHistory {
  rotas: RotaSnapshot[];
  currentRotaId: string | null;
  /** Idempotency keys of next-week operations already applied. */
  appliedKeys: string[];
}

export interface StartNextWeekResult {
  history: RotaHistory;
  /** started: archived + new rota · duplicate: replayed key · not_ready: current rota has not reached its last day. */
  status: "started" | "duplicate" | "not_ready";
  duplicate: boolean;
  rota: RotaSnapshot;
}

/**
 * Archive the current rota exactly once and start the next one from the same
 * shelf. Day records are never touched here, so history and the streak survive.
 */
export function startNextWeek(
  history: RotaHistory,
  args: {
    idempotencyKey: string;
    now: ISODateTime;
    newRotaId: string;
    startDate: SkincareDate;
    products: ShelfProduct[];
    build: Omit<BuildRotaInput, "rotaId" | "weekNumber" | "startDate" | "timeZone" | "createdAt" | "products" | "previousRotaId">;
  },
): StartNextWeekResult {
  const current = history.rotas.find((r) => r.id === history.currentRotaId);
  if (!current) throw new Error("No current rota to continue from");
  if (history.appliedKeys.includes(args.idempotencyKey)) {
    return { history, status: "duplicate", duplicate: true, rota: current };
  }
  // Guards against dual startNextWeek / nextDay semantics: a fresh key (double tap,
  // retry from another tab) cannot archive a rota that has not reached its last day.
  const today = skincareDateAt(args.now, current.timeZone);
  if (current.archivedAt || compareDates(today, current.days[6].skincareDate) < 0) {
    return { history, status: "not_ready", duplicate: true, rota: current };
  }
  const next = buildRota({
    ...args.build,
    rotaId: args.newRotaId,
    weekNumber: current.weekNumber + 1,
    startDate: args.startDate,
    timeZone: current.timeZone,
    createdAt: args.now,
    products: args.products,
    previousRotaId: current.id,
  });
  return {
    status: "started",
    duplicate: false,
    rota: next,
    history: {
      rotas: [...history.rotas.map((r) => (r.id === current.id ? { ...r, archivedAt: args.now } : r)), next],
      currentRotaId: next.id,
      appliedKeys: [...history.appliedKeys, args.idempotencyKey],
    },
  };
}

/** Default start for the next rota: the day after the previous rota's last day, or today if later. */
export function nextRotaStart(previous: RotaSnapshot, now: Date | ISODateTime): SkincareDate {
  const today = skincareDateAt(now, previous.timeZone);
  const after = addDays(previous.days[6].skincareDate, 1);
  return compareDates(after, today) >= 0 ? after : today;
}

export function recordReflection(
  rota: RotaSnapshot,
  feeling: Feeling,
  idempotencyKey: string,
  now: ISODateTime,
): RotaSnapshot {
  if (rota.reflection?.idempotencyKey === idempotencyKey) return rota;
  return { ...rota, reflection: { feeling, recordedAt: now, idempotencyKey } };
}

export const REFLECTION_NOTE: Record<Feeling, string> = {
  calm: "Next week keeps the same plan. Nothing gets stronger automatically.",
  bit_irritated: "Next week keeps the same plan, no stronger. You can swap any night to recovery.",
  very_irritated:
    "Next week keeps the same plan, no stronger. If irritation continues, talk to a pharmacist before your next treatment night.",
};
