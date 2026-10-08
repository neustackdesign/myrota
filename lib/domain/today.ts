import { computeStreak, dayStatus, listMisses, sessionDone, streakIfRescued, type MissedDay, type StreakSummary } from "./records";
import { canSwapToRecovery } from "./scheduler";
import { compareDates, diffDays, isLateNight, localHour, skincareDateAt } from "./skincare-day";
import { recordsForRota, summarizeWeek, type WeekSummary } from "./week";
import type {
  CompletionEvent,
  DayRecord,
  DayStatus,
  DayType,
  IanaTimeZone,
  ISODateTime,
  RotaDayPlan,
  RotaSnapshot,
  RotaStep,
  SessionKind,
  SkincareDate,
} from "./types";

/**
 * Everything the Today screen renders, derived from rota snapshots + dated
 * records + the current instant. Pure, so the HTTP and demo repositories share
 * one derivation and every state is testable.
 */

export interface SessionView {
  kind: SessionKind;
  steps: RotaStep[];
  done: boolean;
  doneAt: ISODateTime | null;
}

export interface WeekDayView {
  index: number;
  skincareDate: SkincareDate;
  status: DayStatus;
  type: DayType;
  swapped: boolean;
  plan: RotaDayPlan;
}

export interface TodayView {
  rota: RotaSnapshot;
  timeZone: IanaTimeZone;
  skincareDate: SkincareDate;
  /** -1 when today is outside the current rota (week ended, next not started). */
  dayIndex: number;
  day: RotaDayPlan | null;
  sessions: { am: SessionView | null; pm: SessionView | null };
  rest: { done: boolean; doneAt: ISODateTime | null } | null;
  dayComplete: boolean;
  week: WeekDayView[];
  streak: StreakSummary;
  misses: MissedDay[];
  /** The miss to offer first: the eligible one that expires soonest. */
  rescueOffer: MissedDay | null;
  rescuePreview: StreakSummary | null;
  /** Misses that can no longer be rescued, so the UI can name them rather than erase them. */
  unrescuable: MissedDay[];
  atmosphere: "am" | "pm";
  lateNight: boolean;
  canSwap: boolean;
  weekSummary: WeekSummary;
}

function eventFor(record: DayRecord | undefined, session: CompletionEvent["session"]) {
  return record?.events.find((e) => e.session === session && e.skincareDate === record.skincareDate && e.rotaId === record.rotaId) ?? null;
}

export function buildTodayView(args: {
  rota: RotaSnapshot;
  /** Every rota still relevant to Rescue (current + previous week). */
  rotas: RotaSnapshot[];
  records: DayRecord[];
  now: Date | ISODateTime;
  timeZone: IanaTimeZone;
}): TodayView {
  const { rota, now, timeZone } = args;
  const today = skincareDateAt(now, timeZone);
  const offset = diffDays(rota.startDate, today);
  const dayIndex = offset >= 0 && offset < 7 ? offset : -1;
  const allRecords = [
    ...args.records.filter((r) => r.rotaId !== rota.id),
    ...recordsForRota(rota, args.records),
  ];
  const weekRecords = recordsForRota(rota, args.records);
  const day = dayIndex >= 0 ? rota.days[dayIndex] : null;
  const record = dayIndex >= 0 ? weekRecords[dayIndex] : undefined;

  const session = (kind: SessionKind): SessionView | null => {
    if (!day || day[kind].length === 0 || !record) return null;
    const ev = eventFor(record, kind);
    return { kind, steps: day[kind], done: !!ev, doneAt: ev?.occurredAt ?? null };
  };
  const restDay = !!day && day.am.length === 0 && day.pm.length === 0;
  const restEvent = restDay ? eventFor(record, "rest") : null;

  const streakInput = { records: allRecords, rotas: args.rotas, now, timeZone };
  const streak = computeStreak(streakInput);
  const misses = listMisses(allRecords, args.rotas, now);
  const eligible = misses
    .filter((m) => m.status === "eligible")
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const rescueOffer = eligible[0] ?? null;

  const week: WeekDayView[] = rota.days.map((plan, i) => ({
    index: i,
    skincareDate: plan.skincareDate,
    status: dayStatus(weekRecords[i], today),
    type: plan.type,
    swapped: !!plan.swappedToRecovery,
    plan,
  }));

  const hour = localHour(now, timeZone);
  const dayComplete = !!record && compareDates(record.skincareDate, today) === 0 && week[dayIndex]?.status !== "in_progress";

  return {
    rota,
    timeZone,
    skincareDate: today,
    dayIndex,
    day,
    sessions: { am: session("am"), pm: session("pm") },
    rest: restDay ? { done: !!restEvent || (!!record && sessionDone(record, "rest")), doneAt: restEvent?.occurredAt ?? null } : null,
    dayComplete,
    week,
    streak,
    misses,
    rescueOffer,
    rescuePreview: rescueOffer ? streakIfRescued(streakInput, rescueOffer.skincareDate) : null,
    unrescuable: misses.filter((m) => m.status === "expired" || m.status === "rota_rescue_used"),
    atmosphere: hour >= 17 || hour < 4 ? "pm" : "am",
    lateNight: isLateNight(now, timeZone),
    canSwap: dayIndex >= 0 && canSwapToRecovery(rota, dayIndex) && !(record && sessionDone(record, "pm")),
    weekSummary: summarizeWeek(rota, args.records, now),
  };
}
