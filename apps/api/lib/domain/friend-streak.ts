import { addDays, compareDates, skincareDateAt } from "./skincare-day";
import { dayStatus, isEarned, qualifies } from "./records";
import type { DayRecord, IanaTimeZone, ISODateTime, SkincareDate } from "./types";

/**
 * Friend Streak — pair-date policy (deterministic, documented, tested):
 *
 * 1. Each member's skincare dates are computed in THEIR OWN IANA zone with the
 *    04:00 local rollover. Naive UTC date strings are never compared.
 * 2. Pair date D counts when BOTH members have a real qualifying record on
 *    their own skincare date labelled D. Rescued days never count, even though
 *    they keep each person's own continuity streak alive.
 * 3. The pair "today" is min(todayA, todayB): the latest date still open for
 *    at least one member. It counts once both finish and never breaks the
 *    streak while still open. Every earlier date is closed for both.
 *
 * Only completion state and the pair streak leave this module — never
 * products, shelves or private context.
 */

export interface PairMemberInput {
  timeZone: IanaTimeZone;
  records: DayRecord[];
}

export type MemberToday = "done" | "not_yet" | "rest_done" | "no_rota";

export interface FriendStreakSummary {
  streak: number;
  pairToday: SkincareDate;
  pairTodayCounted: boolean;
  me: MemberToday;
  friend: MemberToday;
}

function earnedDates(member: PairMemberInput, now: Date | ISODateTime) {
  const today = skincareDateAt(now, member.timeZone);
  const set = new Set<SkincareDate>();
  for (const r of member.records) {
    if (isEarned(dayStatus(r, today))) set.add(r.skincareDate);
  }
  return { today, set };
}

function memberToday(member: PairMemberInput, today: SkincareDate): MemberToday {
  const record = member.records.find((r) => r.skincareDate === today);
  if (!record) return "no_rota";
  if (!qualifies(record)) return "not_yet";
  return record.scheduled.am || record.scheduled.pm ? "done" : "rest_done";
}

export function computeFriendStreak(
  me: PairMemberInput,
  friend: PairMemberInput,
  now: Date | ISODateTime,
): FriendStreakSummary {
  const a = earnedDates(me, now);
  const b = earnedDates(friend, now);
  const pairToday = compareDates(a.today, b.today) <= 0 ? a.today : b.today;
  const both = (d: SkincareDate) => a.set.has(d) && b.set.has(d);
  const pairTodayCounted = both(pairToday);
  let streak = 0;
  let d = pairTodayCounted ? pairToday : addDays(pairToday, -1);
  while (both(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return {
    streak,
    pairToday,
    pairTodayCounted,
    me: memberToday(me, a.today),
    friend: memberToday(friend, b.today),
  };
}
