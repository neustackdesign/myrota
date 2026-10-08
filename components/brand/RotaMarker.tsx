import { COLOR } from "@/lib/ui/ring";

/**
 * Marker icon set — Brand v4 §7.2 names (48 grid · 3 stroke · solid shadows ·
 * one flat fill). PROVISIONAL re-draw: the hand-drawn RotaMarker source SVGs
 * were not supplied, so these are geometric stand-ins with the same names,
 * stroke, shadow and fill rules. Swap the `ICONS` table for the frozen
 * artwork without touching call sites (docs/ASSET_MANIFEST.md · BR-03).
 */
export type MarkerName =
  | "am" | "pm" | "done" | "rota" | "log" | "history" | "share" | "settings" | "shelf" | "cleanser"
  | "serum" | "jar" | "spf" | "water" | "friends" | "mix" | "rescue" | "reminder" | "add" | "profile";

interface Shape {
  /** Closed shapes: shadowed, filled with the accent (colour) or paper (mono). */
  fills: string[];
  /** Open strokes drawn on top. */
  lines?: string[];
  /** Shapes filled with accent2 (second fill), e.g. the Ember segment on "rota". */
  fills2?: string[];
}

const ICONS: Record<MarkerName, Shape> = {
  am: { fills: ["M24 16a10 10 0 1 1 0 20a10 10 0 1 1 0-20z"], lines: ["M24 5v5", "M24 42v-1", "M9 26H5", "M43 26h-4", "M12 13l3 3", "M36 13l-3 3"] },
  pm: { fills: ["M30 8a16 16 0 1 0 10 27a13 13 0 0 1-10-27z"], lines: ["M38 10l2 2", "M41 18h2"] },
  done: { fills: ["M24 8a16 16 0 1 1 0 32a16 16 0 1 1 0-32z"], lines: ["M16 24.5l5.5 5.5L32 19"] },
  rota: { fills: ["M24 9a15 15 0 1 1-.1 0z"], fills2: ["M24 9a15 15 0 0 1 11 4.8l-3.5 3.4A10 10 0 0 0 24 14z"], lines: ["M24 14a10 10 0 1 0 .1 0"] },
  log: { fills: ["M12 8h18l6 6v26H12z"], lines: ["M18 22h12", "M18 28h12", "M18 34h7", "M30 8v6h6"] },
  history: { fills: ["M24 8a16 16 0 1 1 0 32a16 16 0 1 1 0-32z"], lines: ["M24 15v10l6 4"] },
  share: { fills: ["M12 22h24v18H12z"], lines: ["M24 30V7", "M17 13l7-6l7 6"] },
  settings: { fills: ["M24 13a11 11 0 1 1 0 22a11 11 0 1 1 0-22z"], lines: ["M24 5v6", "M24 37v6", "M5 24h6", "M37 24h6", "M24 20a4 4 0 1 1 0 8a4 4 0 1 1 0-8"] },
  shelf: { fills: ["M11 12h9v20h-9z", "M24 17h6v15h-6z", "M33 9h5v23h-5z"], lines: ["M6 32h36", "M6 40h36"] },
  cleanser: { fills: ["M15 18h18v24H15z"], lines: ["M20 18v-5h8v5", "M24 13V8h9", "M19 30h10"] },
  serum: { fills: ["M17 22h14v20H17z"], lines: ["M20 22v-6h8v6", "M22 16V8a2 2 0 0 1 4 0v8"] },
  jar: { fills: ["M11 21h26v19H11z", "M13 13h22v8H13z"], lines: ["M17 30h14"] },
  spf: { fills: ["M14 14h20l-3 28H17z"], lines: ["M18 9h12v5", "M24 24a4 4 0 1 1 0 8a4 4 0 1 1 0-8"] },
  water: { fills: ["M24 6c6 10 12 16 12 23a12 12 0 0 1-24 0c0-7 6-13 12-23z"], lines: ["M18 30a6 6 0 0 0 4 6"] },
  friends: { fills: ["M17 10a7 7 0 1 1 0 14a7 7 0 1 1 0-14z", "M31 13a6 6 0 1 1 0 12a6 6 0 1 1 0-12z"], lines: ["M5 40c1-8 6-12 12-12s11 4 12 12", "M27 30c2-2 3-2 4-2c6 0 10 4 11 12"] },
  mix: { fills: ["M18 13a11 11 0 1 1 0 22a11 11 0 1 1 0-22z"], fills2: ["M30 13a11 11 0 1 1 0 22a11 11 0 1 1 0-22z"] },
  rescue: { fills: ["M24 7a17 17 0 1 1 0 34a17 17 0 1 1 0-34z"], lines: ["M24 16a8 8 0 1 0 .1 0", "M24 7v9", "M24 32v9", "M7 24h9", "M32 24h9"] },
  reminder: { fills: ["M14 34c2-3 2-6 2-12a8 8 0 0 1 16 0c0 6 0 9 2 12z"], lines: ["M21 39a3 3 0 0 0 6 0", "M24 10V7"] },
  add: { fills: ["M24 8a16 16 0 1 1 0 32a16 16 0 1 1 0-32z"], lines: ["M24 16v16", "M16 24h16"] },
  profile: { fills: ["M24 9a8 8 0 1 1 0 16a8 8 0 1 1 0-16z", "M9 41c1-8 7-12 15-12s14 4 15 12z"] },
};

export interface RotaMarkerProps {
  icon: MarkerName;
  size?: number;
  mode?: "mono" | "colour";
  ink?: string;
  paper?: string;
  accent?: string;
  accent2?: string;
  title?: string;
}

const DEFAULT_ACCENT: Partial<Record<MarkerName, string>> = {
  am: COLOR.apricot, pm: COLOR.tide, done: COLOR.seaGlass, rota: COLOR.porcelain, cleanser: COLOR.seaGlass, serum: COLOR.apricot,
  jar: COLOR.seaGlass, spf: COLOR.apricot, water: COLOR.seaGlass, friends: COLOR.sand, mix: COLOR.ember, rescue: COLOR.seaGlass,
  reminder: COLOR.apricot, add: COLOR.seaGlass, profile: COLOR.sand, share: COLOR.seaGlass, shelf: COLOR.seaGlass,
};

export function RotaMarker({ icon, size = 28, mode = "mono", ink = COLOR.ebony, paper = COLOR.porcelain, accent, accent2, title }: RotaMarkerProps) {
  const shape = ICONS[icon];
  const fill = mode === "colour" ? accent ?? DEFAULT_ACCENT[icon] ?? COLOR.seaGlass : paper;
  const fill2 = mode === "colour" ? accent2 ?? (icon === "mix" ? COLOR.lagoon : COLOR.ember) : paper;
  const sw = size <= 24 ? 3.6 : 3;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ flex: "none", overflow: "visible" }}>
      <g transform="translate(1.6 2.2)" fill={ink} stroke={ink} strokeWidth={sw} strokeLinejoin="round">
        {[...shape.fills, ...(shape.fills2 ?? [])].map((d, i) => (
          <path key={`s${i}`} d={d} />
        ))}
      </g>
      <g stroke={ink} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {shape.fills.map((d, i) => (
          <path key={`f${i}`} d={d} fill={fill} />
        ))}
        {(shape.fills2 ?? []).map((d, i) => (
          <path key={`g${i}`} d={d} fill={fill2} />
        ))}
        {(shape.lines ?? []).map((d, i) => (
          <path key={`l${i}`} d={d} fill="none" />
        ))}
      </g>
    </svg>
  );
}
