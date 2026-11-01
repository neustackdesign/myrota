"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { Grain } from "./Grain";
import { ImageSlot } from "./ImageSlot";

/** Photo frame with optional seven-bar rule and caption — port of Brand v4 `PhotoFrame.dc.html`. */
export interface PhotoFrameProps {
  slot?: string;
  shot?: string;
  field?: string;
  bg?: string;
  ratio?: string;
  rule?: number | string;
  radius?: number | string;
  pad?: number | string;
  capL?: string;
  capR?: string;
  style?: React.CSSProperties;
}

export function PhotoFrame(p: PhotoFrameProps) {
  const r = +(p.rule ?? -1), pad = +(p.pad ?? 12);
  const bars = Array.from({ length: 7 }, (_, i) => ({
    bg: i < r ? "#2A1911" : i === r ? "transparent" : "rgba(42,25,17,.16)",
    edge: i === r ? "inset 0 0 0 1.5px #2A1911" : "none",
  }));
  const v: any = {
    slot: p.slot ?? "photo", shot: p.shot ?? "Photo", field: p.field ?? "skin", bg: p.bg ?? "#E8CDB9",
    ratio: p.ratio ?? "auto", pad: pad + "px", outer: (p.radius ?? 28) + "px", inner: Math.max(6, +(p.radius ?? 28) - 10) + "px",
    hasRule: r >= 0, bars, hasCap: !!(p.capL || p.capR), capL: p.capL ?? "", capR: p.capR ?? "",
  };
  return <div style={{ width: "100%", height: "100%", ...p.style }}>{<><div style={{ position: "relative", width: "100%", height: "100%", boxSizing: "border-box", background: "#FBFAF6", borderRadius: v.outer, padding: v.pad, display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 1px 0 rgba(42,25,17,.06)", outline: "1px solid rgba(42,25,17,.08)", outlineOffset: "-1px" }}>{v.hasRule ? (<><div style={{ display: "flex", gap: "6px", height: "8px", flex: "none" }}>{(v.bars ?? []).map((b: any, b_i: number) => (<Fragment key={b_i}><span style={{ flex: "1", borderRadius: "8px", background: b.bg, boxShadow: b.edge }}></span></Fragment>))}</div></>) : null}<div style={{ position: "relative", overflow: "hidden", flex: "1", minHeight: "0", aspectRatio: v.ratio, borderRadius: v.inner, background: v.bg, color: "#2A1911" }}><Grain preset={v.field} style={{ position: "absolute", inset: "0" }} /><ImageSlot slot={v.slot} shape={"rect"} placeholder={v.shot} style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} /></div>{v.hasCap ? (<><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "0 4px 2px", fontFamily: "var(--font-geist-mono),ui-monospace,monospace", fontSize: "11px", letterSpacing: ".06em", textTransform: "uppercase", color: "#5A3824", whiteSpace: "nowrap", overflow: "hidden" }}><span>{v.capL}</span><span>{v.capR}</span></div></>) : null}</div></>}</div>;
}
