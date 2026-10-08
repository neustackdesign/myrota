import type { IanaTimeZone, ISODateTime, SkincareDate } from "./types";

/**
 * Skincare-day maths. A skincare day runs from 04:00 to 04:00 *user-local wall
 * clock* in the user's IANA zone, so a 00:40 evening session still belongs to
 * the previous day. Everything works on wall-clock parts from Intl, which keeps
 * DST and non-integer offsets correct. Never derive a skincare date from a UTC
 * date string.
 */
export const ROLLOVER_HOUR = 4;

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: IanaTimeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function assertTimeZone(timeZone: IanaTimeZone) {
  try {
    formatter(timeZone);
  } catch {
    throw new RangeError(`Unknown IANA time zone: ${timeZone}`);
  }
}

export function wallParts(instant: Date | ISODateTime, timeZone: IanaTimeZone): WallParts {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new RangeError("Invalid instant");
  const parts = formatter(timeZone).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function isSkincareDate(value: string): value is SkincareDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseDate(date: SkincareDate) {
  if (!isSkincareDate(date)) throw new RangeError(`Invalid skincare date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/** Pure calendar arithmetic on a YYYY-MM-DD label (no time zone involved). */
export function addDays(date: SkincareDate, n: number): SkincareDate {
  const { y, m, d } = parseDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: SkincareDate, b: SkincareDate): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

export function compareDates(a: SkincareDate, b: SkincareDate) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The skincare date an instant belongs to for a user in `timeZone`. */
export function skincareDateAt(
  instant: Date | ISODateTime,
  timeZone: IanaTimeZone,
  rolloverHour = ROLLOVER_HOUR,
): SkincareDate {
  const p = wallParts(instant, timeZone);
  const calendar = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return p.hour < rolloverHour ? addDays(calendar, -1) : calendar;
}

/**
 * The UTC instant at which the local wall-clock time `date hour:00` occurs in
 * `timeZone`. If the wall time falls in a DST gap, the first valid instant
 * after it is returned.
 */
export function zonedWallTimeToInstant(date: SkincareDate, hour: number, timeZone: IanaTimeZone): Date {
  const { y, m, d } = parseDate(date);
  const target = Date.UTC(y, m - 1, d, hour, 0, 0);
  // Iterate offset: guess = target - offset(guess). Converges in <= 3 steps.
  let guess = target;
  for (let i = 0; i < 4; i += 1) {
    const p = wallParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const delta = target - asUtc;
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  // DST gap: walk forward minute by minute until the wall clock passes the target.
  let probe = guess;
  for (let i = 0; i < 180; i += 1) {
    const p = wallParts(new Date(probe), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (asUtc >= target) return new Date(probe);
    probe += 60_000;
  }
  return new Date(guess);
}

/** Instant the skincare day `date` begins (date 04:00 local). */
export function skincareDayStart(date: SkincareDate, timeZone: IanaTimeZone, rolloverHour = ROLLOVER_HOUR): Date {
  return zonedWallTimeToInstant(date, rolloverHour, timeZone);
}

/** Instant the skincare day `date` ends: the next day's 04:00 local rollover. */
export function skincareDayEnd(date: SkincareDate, timeZone: IanaTimeZone, rolloverHour = ROLLOVER_HOUR): Date {
  return zonedWallTimeToInstant(addDays(date, 1), rolloverHour, timeZone);
}

export function localHour(instant: Date | ISODateTime, timeZone: IanaTimeZone): number {
  return wallParts(instant, timeZone).hour;
}

/** True between local midnight and 04:00: the evening still counts for the previous date. */
export function isLateNight(instant: Date | ISODateTime, timeZone: IanaTimeZone, rolloverHour = ROLLOVER_HOUR) {
  return localHour(instant, timeZone) < rolloverHour;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Weekday of a YYYY-MM-DD label (calendar, zone-free). */
export function weekdayOf(date: SkincareDate): string {
  const { y, m, d } = parseDate(date);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function shortLabel(date: SkincareDate): string {
  const { m, d } = parseDate(date);
  return `${d} ${MONTHS[m - 1]}`;
}
