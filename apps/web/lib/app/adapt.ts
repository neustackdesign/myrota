/**
 * Pure adapters from the real domain (RotaSnapshot, TodayView, ShelfProduct)
 * to the visual vocabulary of Prototype v1.6 (day tags, ring tones, step
 * rows). No React, no network: unit-tested in tests/domain/app-adapt.test.ts.
 *
 * Every calculation and trust decision stays in lib/domain; this file only
 * decides how an already-decided fact is drawn.
 */
import { isAnalysable } from "../domain/evidence";
import type { DayStatus, ProductCategory, RotaDayPlan, RotaSnapshot, RotaStep, ShelfProduct, SkincareDate } from "../domain/types";

export const TRACK = "#EADCCF";
export const SEA_GLASS = "#9ED8CF";
/** Prototype v1.6 per-day "done" tones (warm earths). */
export const DONE_TONES = ["#845535", "#2A1911", "#A8764F", "#5A3824", "#845535", "#2A1911", "#A8764F"];

export type DesignDayType = "r" | "b" | "rec" | "base";
export type DesignTag = "Retinoid" | "Exfoliant" | "Recovery" | "Rest" | "Daily";
export type DesignStatus = "done" | "rescued" | "missed" | "today" | "future";

export interface DesignItem {
  productId: string;
  role: string;
  name: string;
  short: string;
  icon: string;
  note: string;
  analysed: boolean;
}
export interface DesignDay {
  index: number;
  date: SkincareDate;
  t: DesignDayType;
  am: DesignItem[];
  pm: DesignItem[];
  swapped: boolean;
}

const CATEGORY_ROLE: Record<ProductCategory, string> = { cleanser: "cleanser", toner: "toner", serum: "serum", treatment: "treatment", moisturiser: "moist", sunscreen: "spf", other: "other" };
export const CATEGORY_ICON: Record<ProductCategory, string> = { cleanser: "cleanser", toner: "water", serum: "serum", treatment: "serum", moisturiser: "jar", sunscreen: "spf", other: "jar" };
export const CATEGORY_LABEL: Record<ProductCategory, string> = { cleanser: "Cleanser", toner: "Toner", serum: "Serum", treatment: "Treatment", moisturiser: "Moisturiser", sunscreen: "Sunscreen", other: "Other" };
/** Application notes from the prototype; they describe order only, never clinical dosing. */
const NOTE: Record<string, string> = {
  cleanser: "Massage 30 seconds, rinse",
  toner: "Pat in with hands",
  serum: "Before moisturiser",
  treatment: "As your plan shows",
  moist: "Seal it all in",
  spf: "Last step in the morning",
  other: "In the order shown",
  unknown: "Your choice · not analysed",
};

export function itemOf(step: RotaStep): DesignItem {
  const role = step.analysed ? CATEGORY_ROLE[step.category] : "unknown";
  return {
    productId: step.productId,
    role,
    name: step.displayName,
    short: step.displayName,
    icon: CATEGORY_ICON[step.category] ?? "jar",
    note: NOTE[role] ?? NOTE.other,
    analysed: step.analysed,
  };
}

export function designType(plan: RotaDayPlan): DesignDayType {
  if (plan.type === "treatment") return plan.pm.some((s) => s.activeClass === "retinoid") || plan.am.some((s) => s.activeClass === "retinoid") ? "r" : "b";
  if (plan.type === "recovery") return "rec";
  return "base";
}

export function designDays(rota: Pick<RotaSnapshot, "days">): DesignDay[] {
  return rota.days.map((plan) => ({
    index: plan.index,
    date: plan.skincareDate,
    t: designType(plan),
    am: plan.am.map(itemOf),
    pm: plan.pm.map(itemOf),
    swapped: !!plan.swappedToRecovery,
  }));
}

export function tagOf(day: Pick<DesignDay, "t" | "am" | "pm">): DesignTag {
  if (!day.am.length && !day.pm.length) return "Rest";
  return ({ r: "Retinoid", b: "Exfoliant", rec: "Recovery", base: "Daily" } as const)[day.t];
}

export function dayStatementOf(day: Pick<DesignDay, "t" | "am" | "pm">): string {
  if (!day.am.length && !day.pm.length) return "Rest day.";
  return ({ r: "Retinoid night.", b: "Exfoliant night.", rec: "Recovery night.", base: "Daily rota." } as const)[day.t];
}

/** Domain day status → prototype ring/strip status, relative to today's index. */
export function designStatus(status: DayStatus, index: number, todayIndex: number): DesignStatus {
  if (status === "complete" || status === "rest_complete") return "done";
  if (status === "rescued") return "rescued";
  if (status === "missed") return "missed";
  if (index === todayIndex) return "today";
  if (todayIndex >= 0 && index < todayIndex) return "missed";
  return "future";
}

export function toneOf(day: Pick<DesignDay, "t" | "index">, st: DesignStatus): string {
  if (st === "done") return day.t === "rec" ? SEA_GLASS : DONE_TONES[day.index % 7];
  if (st === "rescued") return SEA_GLASS;
  if (st === "missed") return "x";
  return TRACK;
}

/** Weekday names from the real skincare date (calendar label, not a UTC instant). */
export function weekday(date: SkincareDate, style: "short" | "long" = "short"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function dateLabel(date: SkincareDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export type Provenance = "verified" | "user-confirmed" | "corrected" | "partial" | "unknown";
export const PROV_LABEL: Record<Provenance, [string, string]> = {
  verified: ["Verified · matched to library", "#17605F"],
  "user-confirmed": ["You confirmed this", "#2A1911"],
  corrected: ["You corrected ingredients · awaiting confirmation", "#2A1911"],
  partial: ["Partly read · left out of checks", "#5A3824"],
  unknown: ["Unknown · not analysed", "#5A3824"],
};
/** Ingredient-evidence provenance only; identity confirmation never upgrades it. */
export function provenanceOf(p: Pick<ShelfProduct, "inciStatus">): Provenance {
  switch (p.inciStatus) {
    case "verified": return "verified";
    case "user_confirmed": return "user-confirmed";
    case "corrected": return "corrected";
    case "partial": return "partial";
    default: return "unknown";
  }
}

export function sessionsFor(productId: string, days: DesignDay[]): { am: boolean; pm: boolean } {
  return {
    am: days.some((d) => d.am.some((i) => i.productId === productId)),
    pm: days.some((d) => d.pm.some((i) => i.productId === productId)),
  };
}

export function shelfRole(p: ShelfProduct): string {
  if (p.flags?.length) return "Flagged";
  if (!isAnalysable(p)) return p.inciStatus === "partial" || p.inciStatus === "corrected" ? "Partly read" : "Unknown";
  return CATEGORY_LABEL[p.category] ?? "Other";
}

export const HELD_REASON_TEXT: Record<string, string> = {
  finished: "Finished",
  safety_flag: "Kept out of your rota · safety note",
  context_hold: "Held · check with a professional first",
  insufficient_evidence: "Waiting for a reviewed rule · not scheduled",
  not_analysable: "On your shelf, not in your rota",
};
