/**
 * myrota wordmark — port of Brand v4 `Wordmark.dc.html`: "myr" + a seven-
 * segment ring "o" + "ta". Geometry (box, stroke, gap) follows the source
 * exactly; fonts come from next/font CSS variables (no extracted binaries).
 */
const FONT_VAR: Record<string, string> = {
  "Faculty Glyphic": "var(--font-faculty-glyphic), Georgia, serif",
  Geist: "var(--font-geist), system-ui, sans-serif",
  Archivo: "'Archivo', system-ui, sans-serif",
  "Hanken Grotesk": "'Hanken Grotesk', system-ui, sans-serif",
};
const METRICS: Record<string, { xh: number; ls: number }> = { Geist: { xh: 0.53, ls: -0.035 }, Archivo: { xh: 0.54, ls: -0.025 }, "Hanken Grotesk": { xh: 0.5, ls: -0.03 } };

export interface WordmarkProps {
  size?: number | string;
  font?: "Faculty Glyphic" | "Geist" | "Archivo" | "Hanken Grotesk";
  weight?: number;
  stretch?: number;
  ink?: string;
  accent?: string;
  tones?: string;
  tracking?: number;
  /** Accessible name; the visual letters are aria-hidden. */
  label?: string;
  style?: React.CSSProperties;
}

export function Wordmark(p: WordmarkProps) {
  const font = p.font ?? "Faculty Glyphic";
  const a = p.accent ?? "#FF5A1F";
  const size = +(p.size ?? 64);
  const M = METRICS[font];
  const w = +(p.weight ?? (font === "Faculty Glyphic" ? 400 : 500));
  let box: number, sw: number, ls: number, ml: string, mr: string, mb: string, dy = "0em";
  if (M) {
    const stem = 0.07 + (w - 400) * 0.00016;
    box = (1.03 * M.xh - stem) / 0.84;
    sw = (stem / box) * 100;
    ls = M.ls; ml = "0.03em"; mr = "0.025em"; mb = "-0.01em";
  } else {
    box = 0.5964; sw = 14.37; ls = 0; ml = "-0.0099em"; mr = "-0.025em"; mb = "0em"; dy = "0.0232em";
  }
  const C = 2 * Math.PI * 42, seg = C / 7, rPx = box * 0.42 * size, g = 42 * Math.max(7 / 42, 1 / rPx), d = seg - g;
  const tones = String(p.tones || "").split(",").map((t) => t.trim()).filter(Boolean);
  const segDash = `${d} ${C - d}`;
  const ring = Array.from({ length: 7 }, (_, i) => ({ c: tones.length >= 7 ? tones[i] : "currentColor", o: -g / 2 - i * seg }));
  return (
    <span
      role="img"
      aria-label={p.label ?? "myrota"}
      style={{ display: "inline-flex", alignItems: "baseline", fontFamily: FONT_VAR[font], fontWeight: w, fontStretch: `${p.stretch ?? 100}%`, fontSize: `${size}px`, color: p.ink ?? "#1E120E", lineHeight: 1, letterSpacing: `${p.tracking ?? ls}em`, whiteSpace: "nowrap", ...p.style }}
    >
      <span aria-hidden="true">myr</span>
      <svg aria-hidden="true" viewBox="0 0 100 100" style={{ width: `${box}em`, height: `${box}em`, margin: `0 ${mr} ${mb} ${ml}`, position: "relative", top: dy, overflow: "visible", display: "block", flex: "none" }}>
        {ring.map((r, i) => (
          <circle key={i} cx="50" cy="50" r="42" transform="rotate(-90 50 50)" style={{ fill: "none", stroke: r.c, strokeWidth: sw, strokeDasharray: segDash, strokeDashoffset: r.o }} />
        ))}
        <circle cx="50" cy="50" r="42" transform="rotate(-90 50 50)" style={{ fill: "none", stroke: a === "none" ? "transparent" : a, strokeWidth: sw, strokeDasharray: segDash, strokeDashoffset: ring[0].o }} />
      </svg>
      <span aria-hidden="true">ta</span>
    </span>
  );
}
