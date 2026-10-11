import { buildRota, buildShelfCheck, type BuildRotaInput } from "./scheduler";
import { addDays, compareDates, skincareDateAt } from "./skincare-day";
import { dayStatus, isEarned, qualifies } from "./records";
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

/** This rota plus the earlier revisions of the same week it replaced. */
export function weekRotaIds(rota: Pick<RotaSnapshot, "id" | "supersedes">): string[] {
  return [rota.id, ...(rota.supersedes ?? [])];
}

/**
 * Fill in records for every rota day so the UI never infers status from absence.
 * A day recorded under an earlier revision of this week (before a mid-week
 * replan) still belongs to this week; a real completion wins over an empty record.
 */
export function recordsForRota(rota: RotaSnapshot, records: DayRecord[]): DayRecord[] {
  const ids = weekRotaIds(rota);
  return rota.days.map((day) => {
    const matches = records.filter((r) => ids.includes(r.rotaId) && r.skincareDate === day.skincareDate);
    const found = matches.find(qualifies) ?? matches.find((r) => r.rotaId === rota.id) ?? matches[0];
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

/**
 * Replan THIS week after the Shelf changed (Issue #19 replan continuity).
 *
 * The week keeps its identity: same start date, week number, previous rota and
 * Rescue. Days already past, and any day with recorded activity, keep the plan
 * they were followed under, so a completed day stays completed and is never
 * re-planned. Only the remaining days are rebuilt from the current Shelf, with
 * the last kept night feeding recovery spacing. Day records are never touched;
 * the replaced revision's id is listed in `supersedes` so its records still count.
 * Returns null once the week is over: start the next week instead.
 */
export function reviseRota(
  current: RotaSnapshot,
  args: {
    newRotaId: string;
    now: ISODateTime;
    products: ShelfProduct[];
    records: DayRecord[];
    build: Omit<BuildRotaInput, "rotaId" | "weekNumber" | "startDate" | "timeZone" | "createdAt" | "products" | "previousRotaId" | "previousFinalNight">;
  },
): RotaSnapshot | null {
  const today = skincareDateAt(args.now, current.timeZone);
  if (compareDates(today, current.days[6].skincareDate) > 0) return null;
  const recorded = recordsForRota(current, args.records);
  const frozen = current.days.map((d, i) =>
    compareDates(d.skincareDate, today) < 0 || recorded[i].events.length > 0 || !!recorded[i].rescue || !!recorded[i].rescueDeclinedAt);
  // Kept days are a prefix (past days, and today once anything was recorded).
  const keep = frozen.lastIndexOf(true) + 1;
  const lastKept = keep > 0 ? current.days[keep - 1] : null;
  const rebuilt = buildRota({
    ...args.build,
    rotaId: args.newRotaId,
    weekNumber: current.weekNumber,
    startDate: current.days[Math.min(keep, 6)].skincareDate,
    timeZone: current.timeZone,
    createdAt: args.now,
    products: args.products,
    previousRotaId: current.previousRotaId ?? null,
    previousFinalNight: lastKept ? lastKept.pm.flatMap((s) => (s.activeClass ? [s.activeClass] : [])) : undefined,
  });
  const days = current.days.map((d, i) =>
    i < keep ? d : { ...rebuilt.days[i - keep], index: i, skincareDate: d.skincareDate });
  const revised: RotaSnapshot = {
    ...rebuilt,
    startDate: current.startDate,
    days,
    rescueUsedFor: current.rescueUsedFor ?? null,
    reflection: current.reflection ?? null,
    archivedAt: null,
    supersedes: [...(current.supersedes ?? []), current.id],
  };
  revised.shelfCheck = buildShelfCheck(revised, args.products);
  return revised;
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
