import type { DayStatus, DayType } from "../domain/types";

/**
 * Visual translation of day states for the Rota Ring and WeekStrip.
 *
 * The prototype encodes a missed segment with the sentinel string "x". That
 * sentinel exists ONLY in this adapter (`toPrototypeTones`) for parity with the
 * Claude Design source; domain code never sees it.
 */

export const COLOR = {
  ember: "#EE6F3E",
  apricot: "#F6B48F",
  dusk: "#1E3A3C",
  tide: "#1F7F7E",
  seaGlassInk: "#17605F",
  seaGlass: "#9ED8CF",
  dew: "#E3F1EC",
  lagoon: "#3E63D8",
  porcelain: "#FBFAF6",
  pearl: "#F7EFE7",
  shell: "#F1E0D2",
  roseSand: "#E8CDB9",
  sand: "#DDBB9C",
  honey: "#C99A72",
  almond: "#A8764F",
  sienna: "#845535",
  umber: "#5A3824",
  ebony: "#2A1911",
  track: "#E8D8C9",
  recoveryOutline: "#7EC4BA",
} as const;

/** Non-monotonic order: no tone implies "better" progress. All hold 3:1 on light grounds. */
export const DONE_TONES = [COLOR.sienna, COLOR.ebony, COLOR.almond, COLOR.umber, COLOR.sienna, COLOR.ebony, COLOR.almond];

export type SegmentKind =
  | "done"
  | "recovery_done"
  | "rescued"
  | "today"
  | "today_done"
  | "missed"
  | "future"
  | "future_recovery";

export interface RingSegment {
  kind: SegmentKind;
  color: string;
  label: string;
}

const RECOVERY_LIKE: DayType[] = ["recovery", "rest", "daily"];

export function segmentFor(index: number, status: DayStatus, type: DayType, isToday: boolean): RingSegment {
  if (status === "complete" || status === "rest_complete") {
    const recovery = status === "rest_complete" || type === "recovery";
    return {
      kind: isToday ? "today_done" : recovery ? "recovery_done" : "done",
      color: recovery ? COLOR.seaGlass : DONE_TONES[index % 7],
      label: status === "rest_complete" ? "rest day done" : recovery ? "recovery day done" : "done",
    };
  }
  if (status === "rescued") return { kind: "rescued", color: COLOR.seaGlass, label: "rescued" };
  if (status === "missed") return { kind: "missed", color: COLOR.sienna, label: "missed" };
  if (status === "in_progress" || isToday) return { kind: "today", color: COLOR.ember, label: "today" };
  return type === "treatment" || !RECOVERY_LIKE.includes(type)
    ? { kind: "future", color: COLOR.track, label: "planned" }
    : { kind: "future_recovery", color: COLOR.track, label: type === "rest" ? "planned rest day" : "planned recovery day" };
}

/** Prototype-compatible tone list: missed → "x" sentinel (thin Sienna hairline in RotaRing). */
export function toPrototypeTones(segments: RingSegment[]): string[] {
  return segments.map((s) => (s.kind === "missed" ? "x" : s.kind === "today" ? COLOR.track : s.color));
}
