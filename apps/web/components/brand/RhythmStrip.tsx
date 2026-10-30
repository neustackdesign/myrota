"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useState } from "react";
import { RotaMarker } from "./RotaMarker";

/** Seven-day rhythm strip with legend and detail line — port of Brand v4 `RhythmStrip.dc.html`. */
export type RhythmType = "Retinoid" | "Exfoliant" | "Recovery" | "Rest";
export interface RhythmDay { d: string; long?: string; type: RhythmType | string; steps?: string; unknown?: string }

const TYPE: Record<string, { bg: string; icon: string; iconInk: string; edge: string }> = {
  Retinoid: { bg: "#1E3A3C", icon: "serum", iconInk: "#FBFAF6", edge: "none" },
  Exfoliant: { bg: "#1F7F7E", icon: "water", iconInk: "#FBFAF6", edge: "none" },
  Recovery: { bg: "#9ED8CF", icon: "jar", iconInk: "#2A1911", edge: "none" },
  Rest: { bg: "#E3F1EC", icon: "pm", iconInk: "#5A3824", edge: "inset 0 0 0 1px rgba(42,25,17,.14)" },
  // Production addition: a day with only basic steps (no reviewed actives).
  Daily: { bg: "#F1E0D2", icon: "am", iconInk: "#2A1911", edge: "none" },
};
const DEFAULT_DAYS: RhythmDay[] = [["We", "Retinoid"], ["Th", "Recovery"], ["Fr", "Exfoliant"], ["Sa", "Recovery"], ["Su", "Retinoid"], ["Mo", "Rest"], ["Tu", "Recovery"]].map(([d, type]) => ({ d, type, steps: "" }));

export interface RhythmStripProps {
  days?: RhythmDay[];
  today?: number;
  selected?: number;
  scale?: number | string;
  words?: boolean;
  legend?: boolean;
  detail?: boolean;
  interactive?: boolean;
  onDark?: boolean;
  plate?: string;
  todayWord?: string;
  onPick?: (i: number) => void;
  style?: React.CSSProperties;
}

export function RhythmStrip(p: RhythmStripProps) {
  const [selState, setSel] = useState(-1);
  const scale = +(p.scale ?? 1), onDark = !!p.onDark;
  const days = Array.isArray(p.days) && p.days.length ? p.days : DEFAULT_DAYS;
  const today = +(p.today ?? 0), interactive = (p.interactive ?? true) !== false;
  const ext = p.selected !== undefined && p.selected !== null && +p.selected >= 0 ? +p.selected : null;
  const sel = ext !== null ? ext : selState >= 0 ? selState : today;
  const ink = onDark ? "#FBFAF6" : "#2A1911", sub = onDark ? "rgba(251,250,246,.75)" : "#5A3824";
  const ringC = onDark ? "#FBFAF6" : "#2A1911";
  const tiles = days.map((x, i) => {
    const t = TYPE[x.type] || TYPE.Rest;
    const on = i === sel;
    return {
      d: x.d, word: x.type, icon: t.icon, iconInk: t.iconInk, bg: t.bg, on,
      aria: (x.long || x.d) + " · " + x.type + (i === today ? " · today" : ""),
      ring: on ? `${t.edge === "none" ? "" : t.edge + ","}0 0 0 3px ${onDark ? "#1E3A3C" : (p.plate ?? "#FBFAF6")},0 0 0 5px ${ringC}` : t.edge,
      pick: () => { if (!interactive) return; setSel(i); p.onPick?.(i); },
    };
  });
  const present = [...new Set(days.map((x) => x.type))].filter((t) => t !== "Rest" || days.every((x) => x.type === "Rest"));
  const legend = present.map((t) => ({ t, bg: (TYPE[t] || TYPE.Rest).bg, edge: (TYPE[t] || TYPE.Rest).edge }));
  const cur = days[sel] || days[0], isToday = sel === today;
  const detailHead = (isToday ? (p.todayWord ?? "Tonight") : (cur.long || cur.d)) + " · " + cur.type + (cur.type === "Rest" ? " day" : cur.type === "Daily" ? "" : " night");
  const body = cur.type === "Rest" ? (cur.steps || "Nothing scheduled. One check-in.") : (cur.steps || "");
  const v: any = {
    tiles, legend, ink, dayInk: sub, legendInk: sub, wordInk: ink, unkInk: onDark ? "#F6B48F" : "#845535",
    tile: Math.round(44 * scale) + "px", radius: Math.round(12 * scale) + "px", gap: Math.round(6 * scale) + "px", gapIn: Math.round(6 * scale) + "px", gapOuter: Math.round(12 * scale) + "px",
    iconPx: Math.round(20 * scale), dayFs: Math.round(12 * scale) + "px", wordFs: Math.round(11 * scale) + "px", hitPad: interactive ? "2px" : "0px", cursor: interactive ? "pointer" : "default",
    showWords: !!p.words, showLegend: (p.legend ?? true) !== false, showDetail: (p.detail ?? true) !== false,
    detailHead, detailSep: body ? " — " : "", detailBody: body, hasUnk: !!cur.unknown, detailUnk: cur.unknown ? "+ " + cur.unknown + " (not analysed)" : "",
  };
  return <div style={p.style}>{<><div style={{ display: "flex", flexDirection: "column", gap: v.gapOuter, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-geist),system-ui,sans-serif", color: v.ink }}><div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: v.gap, justifyItems: "center" }}>{(v.tiles ?? []).map((t: any, t_i: number) => (<Fragment key={t_i}><button onClick={t.pick} aria-label={t.aria} aria-pressed={t.on} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: v.gapIn, background: "none", border: "0", padding: `${v.hitPad} 0`, margin: `-${v.hitPad} 0`, cursor: v.cursor, fontFamily: "inherit", color: "inherit", minWidth: "0", width: "100%" }}><span style={{ fontSize: v.dayFs, lineHeight: "1", color: v.dayInk }}>{t.d}</span><span style={{ position: "relative", width: v.tile, height: v.tile, borderRadius: v.radius, background: t.bg, display: "grid", placeItems: "center", boxShadow: t.ring, transition: "box-shadow 180ms" }}><RotaMarker icon={t.icon} size={v.iconPx} ink={t.iconInk} /></span>{v.showWords ? (<><span style={{ fontSize: v.wordFs, lineHeight: "1.2", color: v.wordInk, whiteSpace: "nowrap" }}>{t.word}</span></>) : null}</button></Fragment>))}</div>{v.showLegend ? (<><div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: "12px", lineHeight: "1.3", color: v.legendInk }}>{(v.legend ?? []).map((l: any, l_i: number) => (<Fragment key={l_i}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "2px", background: l.bg, boxShadow: l.edge }}></span>{l.t}</span></Fragment>))}</div></>) : null}{v.showDetail ? (<><p style={{ margin: "0", fontSize: "15px", lineHeight: "1.4", textWrap: "pretty", maxWidth: "40ch" }}><b style={{ fontWeight: "600" }}>{v.detailHead}</b>{v.detailSep}{v.detailBody}{v.hasUnk ? (<><span style={{ color: v.unkInk }}>{v.detailUnk}</span></>) : null}</p></>) : null}</div></>}</div>;
}
