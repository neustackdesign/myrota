"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import { RotaRing } from "./RotaRing";

/**
 * Avatar — port of Brand v4 `Avatar.dc.html`: an initials monogram (named
 * guest), a doodle (unnamed guest) or a built look; optional Rota Ring.
 */
export interface AvatarLook { skin: number; hair?: string; face?: string; extra?: string; bg?: string }
export interface AvatarProps {
  who?: string;
  seed?: string;
  size?: number | string;
  ring?: boolean;
  look?: AvatarLook | null;
  skin?: number;
  hair?: string;
  face?: string;
  extra?: string;
  bg?: string;
  filled?: number | string;
  hollow?: number | string;
  rescued?: string;
  tones?: string;
  ringSw?: number | string;
  outline?: boolean;
  style?: React.CSSProperties;
}

const SKIN = ["#F5E2D3", "#EED3BE", "#E2C0A3", "#D1A47F", "#B98661", "#9A6B48", "#7C5235", "#5E3B25", "#3D2618"];
const BG: [string, string, string][] = [["dew", "#E3F1EC", "#2A1911"], ["seaglass", "#9ED8CF", "#2A1911"], ["shell", "#F1E0D2", "#2A1911"], ["apricot", "#F6B48F", "#2A1911"], ["rosesand", "#E8CDB9", "#2A1911"], ["tide", "#1F7F7E", "#FBFAF6"]];
const DOODLE: Record<string, [string, string][]> = {
  drop: [["M80 66 C80 66 71 77 71 82 A9 9 0 0 0 89 82 C89 77 80 66 80 66 Z", "none"]],
  moon: [["M85 69 A11 11 0 1 0 85 91 A8 8 0 1 1 85 69 Z", "none"]],
  sun: [["M74 80 A6 6 0 1 0 86 80 A6 6 0 1 0 74 80 Z", "none"], ["M80 67 V70 M80 90 V93 M67 80 H70 M90 80 H93", "none"]],
  jar: [["M72 77 H88 V90 Q88 92 86 92 H74 Q72 92 72 90 Z", "none"], ["M74 71 H86 V77 H74 Z", "none"]],
  leaf: [["M70 91 C70 77 79 69 91 69 C91 82 84 91 70 91 Z", "none"], ["M70 91 L83 78", "none"]],
  sparkle: [["M80 67 Q81 79 93 80 Q81 81 80 93 Q79 81 67 80 Q79 79 80 67 Z", "none"]],
};
const HAIR: Record<string, { f?: string[]; b?: string[]; l?: string[]; wrap?: boolean; noEars?: boolean }> = {
  lowcut: { f: ["M30 44 C30 25 40 20 50 20 C60 20 70 25 70 44 C66 33 58 29 50 29 C42 29 34 33 30 44 Z"] },
  bald: {},
  coils: { f: ["M28 47 C23 38 27 25 35 21 C40 14 48 14 52 17 C59 13 67 17 69 23 C76 28 77 39 72 47 C68 36 60 31 50 31 C40 31 32 36 28 47 Z"] },
  afro: { b: ["M50 5 C76 5 88 22 86 42 C85 54 80 60 72 60 L28 60 C20 60 15 54 14 42 C12 22 24 5 50 5 Z"], f: ["M30 42 C32 30 40 26 50 26 C60 26 68 30 70 42 C64 35 58 32 50 32 C42 32 36 35 30 42 Z"] },
  puffs: { b: ["M14 28 A13 13 0 1 0 40 28 A13 13 0 1 0 14 28 Z", "M60 28 A13 13 0 1 0 86 28 A13 13 0 1 0 60 28 Z"], f: ["M30 44 C30 25 40 20 50 20 C60 20 70 25 70 44 C66 33 58 29 50 29 C42 29 34 33 30 44 Z"] },
  locs: { b: ["M27 38 Q24 62 25 86 L32 86 Q31 62 33 46 Z", "M67 46 Q69 62 68 86 L75 86 Q76 62 73 38 Z", "M33 40 Q31 60 33 80 L38 80 Q37 60 37 48 Z"], f: ["M28 46 C27 24 40 18 50 18 C60 18 73 24 72 46 C68 33 58 28 50 28 C42 28 32 33 28 46 Z"] },
  braids: { b: ["M26 36 L22 96 L29 96 L33 44 Z", "M67 44 L71 96 L78 96 L74 36 Z", "M31 42 L29 90 L35 90 L37 48 Z", "M63 48 L65 90 L71 90 L69 42 Z"], f: ["M28 46 C27 24 40 18 50 18 C60 18 73 24 72 46 C68 33 58 28 50 28 C42 28 32 33 28 46 Z"], l: ["M40 21 L38 31 M50 19 V29 M60 21 L62 31"] },
  cornrows: { f: ["M30 44 C30 25 40 19 50 19 C60 19 70 25 70 44 C66 33 58 29 50 29 C42 29 34 33 30 44 Z"], l: ["M38 22 Q35 32 33 40 M46 20 Q45 27 44 30 M54 20 Q55 27 56 30 M62 22 Q65 32 67 40"] },
  bun: { b: ["M39 14 A11 11 0 1 0 61 14 A11 11 0 1 0 39 14 Z"], f: ["M30 44 C30 25 40 20 50 20 C60 20 70 25 70 44 C66 33 58 29 50 29 C42 29 34 33 30 44 Z"] },
  long: { b: ["M27 40 C25 60 25 78 22 92 H78 C75 78 75 60 73 40 C71 25 61 18 50 18 C39 18 29 25 27 40 Z"], f: ["M29 46 C29 27 40 19 52 19 C65 19 71 28 71 46 C63 36 51 30 39 34 C34 36 31 40 29 46 Z"] },
  headwrap: { f: ["M25 42 C24 19 39 11 50 11 C61 11 76 19 75 42 C67 34 59 31 50 31 C41 31 33 34 25 42 Z", "M43 14 C40 3 60 3 57 14 Z"], wrap: true },
  hijab: { b: ["M22 52 C20 26 35 14 50 14 C65 14 80 26 78 52 L86 100 H14 Z"], f: ["M29 48 C28 30 39 23 50 23 C61 23 72 30 71 48 C68 36 59 31 50 31 C41 31 32 36 29 48 Z"], noEars: true, wrap: true },
};
const FACE: Record<string, [string, string][]> = {
  calm: [["M38 48 H45 M55 48 H62", "none"], ["M45 59 Q50 61 55 59", "none"]],
  smile: [["M40 48 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M56 48 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z", "#2A1911"], ["M43 57 Q50 64 57 57", "none"]],
  grin: [["M40 48 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z M56 48 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z", "#2A1911"], ["M41 56 Q50 67 59 56 Z", "#FBFAF6"]],
  wink: [["M40 48 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 Z", "#2A1911"], ["M55 49 Q58.5 45 62 49", "none"], ["M43 57 Q50 64 57 57", "none"]],
};
const EXTRA: Record<string, [string, string][]> = {
  none: [],
  patches: [["M36 52 Q41 59 47 52 Q41 54.5 36 52 Z", "#FFE3B3"], ["M53 52 Q59 59 64 52 Q59 54.5 53 52 Z", "#FFE3B3"]],
  mask: [["M33 40 C33 31 67 31 67 40 L66 59 C62 67 38 67 34 59 Z", "#FBFAF6"]],
  towel: [["M24 42 C22 16 38 8 50 8 C62 8 78 16 76 42 C68 33 59 30 50 30 C41 30 32 33 24 42 Z", "#FBFAF6"], ["M34 22 Q50 16 66 22", "none"]],
  headband: [["M29 36 C35 25 65 25 71 36 L71 41 C65 31 35 31 29 41 Z", "#9ED8CF"]],
  glasses: [["M35 48 A7 7 0 1 0 49 48 A7 7 0 1 0 35 48 Z M51 48 A7 7 0 1 0 65 48 A7 7 0 1 0 51 48 Z M49 47 H51", "none"]],
  hoops: [["M26 58 A4.5 4.5 0 1 0 35 58 A4.5 4.5 0 1 0 26 58 Z", "none"], ["M65 58 A4.5 4.5 0 1 0 74 58 A4.5 4.5 0 1 0 65 58 Z", "none"]],
};
function hash(s: string) {
  let h = 2166136261;
  for (const c of String(s || "guest")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function Avatar(p: AvatarProps) {
  const size = +(p.size ?? 40), ring = !!p.ring;
  const look: Partial<AvatarLook> = p.look || {};
  const Lk = { skin: look.skin ?? p.skin, hair: look.hair ?? p.hair, face: look.face ?? p.face, extra: look.extra ?? p.extra, bg: look.bg ?? p.bg };
  const built = Lk.skin !== undefined && Lk.skin !== null && +Lk.skin >= 0;
  const hv = hash(p.seed ?? p.who ?? "guest");
  const bgRow = BG.find((b) => b[0] === Lk.bg) || BG[hv % 6];
  const dk = Object.keys(DOODLE)[(hv >>> 3) % 6];
  const name = (p.who ?? "").trim(), guest = !built && !name;
  const sw = 2.6, parts: { d: string; f: string; sw: number }[] = [], shadow: { d: string }[] = [];
  if (built) {
    const skinN = +(Lk.skin as number);
    const skin = SKIN[Math.max(0, Math.min(8, skinN))], H = HAIR[Lk.hair ?? ""] || HAIR.lowcut, hairC = skinN >= 6 ? "#1A0F0A" : "#2A1911";
    const hairFill = H.wrap ? (Lk.hair === "hijab" ? "#1F7F7E" : "#F6B48F") : hairC;
    const bodyD = "M12 104 C14 82 30 73 50 73 C70 73 86 82 88 104 Z", head = "M30 46 C30 28 39 22 50 22 C61 22 70 28 70 46 C70 60 61 69 50 69 C39 69 30 60 30 46 Z";
    (H.b || []).forEach((d) => parts.push({ d, f: hairFill, sw }));
    if (Lk.hair !== "hijab") parts.push({ d: bodyD, f: "#FBFAF6", sw });
    if (Lk.hair !== "hijab") parts.push({ d: "M43 62 L43 76 C46 79 54 79 57 76 L57 62 Z", f: skin, sw });
    if (!H.noEars) parts.push({ d: "M27 48 A4.5 6 0 1 0 33 48 A4.5 6 0 1 0 27 48 Z M67 48 A4.5 6 0 1 0 73 48 A4.5 6 0 1 0 67 48 Z", f: skin, sw });
    shadow.push({ d: head });
    parts.push({ d: head, f: skin, sw });
    const ex = EXTRA[Lk.extra ?? "none"] || [];
    if (Lk.extra === "mask") ex.forEach(([d, f]) => parts.push({ d, f, sw: sw * 0.8 }));
    (FACE[Lk.face ?? "smile"] || FACE.smile).forEach(([d, f]) => parts.push({ d, f, sw }));
    (H.f || []).forEach((d) => parts.push({ d, f: hairFill, sw }));
    (H.l || []).forEach((d) => parts.push({ d, f: "none", sw: sw * 0.7 }));
    if (Lk.extra !== "mask") ex.forEach(([d, f]) => parts.push({ d, f, sw }));
  }
  const doodle = built ? [] : DOODLE[dk].map(([d, f]) => ({ d, f }));
  const innerPx = ring ? Math.round(size * 0.74) : size;
  const v: any = {
    px: size + "px", size, innerPx: innerPx + "px", hasRing: ring, ringSw: p.ringSw ?? 10,
    filled: p.filled ?? 7, hollow: p.hollow ?? -1, rescued: p.rescued ?? "", tones: p.tones ?? "#E8CDB9,#C99A72,#845535,#DDBB9C,#A8764F,#E8CDB9,#5A3824",
    bgc: bgRow[1], monoInk: bgRow[2], parts, shadow, initial: name && !built ? name[0].toUpperCase() : "", monoFs: Math.round(innerPx * 0.52) + "px",
    doodle, doodleT: guest ? "translate(50 50) scale(2) translate(-80 -80)" : "translate(72 72) scale(.62) translate(-80 -80)",
    edge: p.outline ? "inset 0 0 0 1.5px rgba(42,25,17,.14)" : "none", label: name ? name + "'s avatar" : "Guest avatar",
  };
  return <div style={{ display: "inline-flex", flex: "none", ...p.style }}>{<><div style={{ position: "relative", width: v.px, height: v.px, flex: "none", display: "grid", placeItems: "center" }}>{v.hasRing ? (<><div style={{ position: "absolute", inset: "0", display: "flex" }}><RotaRing size={v.size} filled={v.filled} hollow={v.hollow} rescued={v.rescued} lit={-1} sw={v.ringSw} tones={v.tones} track="#E8D8C9" /></div></>) : null}<div style={{ position: "relative", width: v.innerPx, height: v.innerPx, borderRadius: "50%", overflow: "hidden", flex: "none", boxShadow: v.edge }}><svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block" }} role="img" aria-label={v.label}><rect x="0" y="0" width="100" height="100" style={{ fill: v.bgc }}></rect><g transform="translate(2.5 2.5)">{(v.shadow ?? []).map((p: any, p_i: number) => (<Fragment key={p_i}><path d={p.d} style={{ fill: "#2A1911" }}></path></Fragment>))}</g>{(v.parts ?? []).map((p: any, p_i: number) => (<Fragment key={p_i}><path d={p.d} style={{ fill: p.f, stroke: "#2A1911", strokeWidth: p.sw, strokeLinecap: "round", strokeLinejoin: "round" }}></path></Fragment>))}<g transform={v.doodleT}>{(v.doodle ?? []).map((p: any, p_i: number) => (<Fragment key={p_i}><path d={p.d} style={{ fill: p.f, stroke: v.monoInk, strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round" }}></path></Fragment>))}</g></svg><span aria-hidden="true" style={{ position: "absolute", left: "0", right: "8%", top: "0", bottom: "6%", display: "grid", placeItems: "center", fontFamily: "var(--font-faculty-glyphic),serif", fontSize: v.monoFs, lineHeight: "1", color: v.monoInk }}>{v.initial}</span></div></div></>}</div>;
}
