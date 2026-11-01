/**
 * Rota Ring — port of Brand v4 `RotaRing.dc.html` (v6.1 states): seven
 * segments, optional per-segment tones, `x` tone = missed Sienna hairline,
 * hollow (today), missed notch, rescued Sea-glass with an inner Tide stroke,
 * lit accent overlay and the 520ms fill transition.
 */
export interface RotaRingProps {
  size?: number | string;
  filled?: number | string;
  start?: number | string;
  sw?: number | string;
  gap?: number | string;
  track?: string;
  ink?: string;
  trackOpacity?: number | string;
  accent?: string;
  tones?: string;
  lit?: number | string;
  hollow?: number | string;
  hollowInk?: string;
  /** CSV of segment indices. */
  missed?: string;
  rescued?: string;
  label?: string;
  style?: React.CSSProperties;
}

const idx = (v: unknown) =>
  String(v ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "").map(Number).filter((x) => x >= 0 && x < 7);

export function RotaRing(p: RotaRingProps) {
  const s = +(p.size ?? 120), sw = +(p.sw ?? 14), g = +(p.gap ?? 7);
  const n = Math.max(0, Math.min(7, +(p.filled ?? 0))), st = +(p.start ?? 0);
  const C = 2 * Math.PI * 42, seg = C / 7, d = seg - g;
  const track = p.track ?? p.ink ?? "#1E120E";
  const tones = String(p.tones || "").split(",").map((t) => t.trim()).filter(Boolean);
  const hasT = tones.length >= 7;
  const segDash = `${d} ${C - d}`;
  const segs = Array.from({ length: 7 }, (_, i) => {
    const tk = hasT && i < n ? tones[i] : track;
    return { c: tk === "x" ? "#845535" : tk, w: tk === "x" ? Math.max(2, sw * 0.28) : sw, o: -g / 2 - i * seg, d: segDash };
  });
  const hol = +(p.hollow ?? -1), missed = idx(p.missed), resc = idx(p.rescued);
  const hw = (2 * 100) / s;
  const notch = Math.max(hw * 1.6, 2.4);
  missed.forEach((i) => {
    const hh = (d - notch) / 2;
    segs[i] = { c: track, w: sw, o: -g / 2 - i * seg, d: `${hh} ${notch} ${hh} ${C - d}` };
  });
  resc.forEach((i) => { segs[i] = { ...segs[i], c: "#9ED8CF", w: sw }; });
  const rr = 42 - sw / 2 + hw / 2, C2 = 2 * Math.PI * rr, k = rr / 42;
  let resDash = "0 " + C2, resOff = 0;
  if (resc.length) {
    const pat: number[] = [];
    let pos = 0;
    resc.slice().sort((a, b) => a - b).forEach((i) => { const st0 = (g / 2 + i * seg) * k; pat.push(st0 - pos, d * k); pos = st0 + d * k; });
    const lead = pat.shift() as number;
    pat.push(C2 - pos + lead);
    resDash = pat.join(" ");
    resOff = -lead;
  }
  let hollowD = "M0 0";
  if (hol >= 0 && hol < 7) {
    segs[hol] = { ...segs[hol], c: "transparent" };
    const ri = 42 - sw / 2 + hw / 2, ro = 42 + sw / 2 - hw / 2, a0 = ((g / 2 + hol * seg) / C) * 2 * Math.PI - Math.PI / 2, a1 = a0 + (d / C) * 2 * Math.PI;
    const P = (r: number, a: number) => (50 + r * Math.cos(a)).toFixed(2) + " " + (50 + r * Math.sin(a)).toFixed(2);
    hollowD = "M" + P(ro, a0) + " A" + ro + " " + ro + " 0 0 1 " + P(ro, a1) + " L" + P(ri, a1) + " A" + ri + " " + ri + " 0 0 0 " + P(ri, a0) + " Z";
  }
  let fillDash: string, off: number;
  if (hasT) {
    const lit = +(p.lit ?? -1);
    fillDash = lit >= 0 ? segDash : `0 ${C}`;
    off = -g / 2 - Math.max(0, lit) * seg;
  } else {
    const fill: number[] = [];
    for (let i = 0; i < n; i++) fill.push(d, i < n - 1 ? g : C - n * seg + g);
    fillDash = n ? fill.join(" ") : `0 ${C}`;
    off = -g / 2 - st * seg;
  }
  return (
    <div style={{ width: s + "px", height: s + "px", display: "flex", flex: "none", ...p.style }} role={p.label ? "img" : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : true}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
        {segs.map((x, i) => (
          <circle key={i} cx="50" cy="50" r="42" transform="rotate(-90 50 50)" style={{ fill: "none", stroke: x.c, strokeOpacity: p.trackOpacity ?? 1, strokeWidth: x.w, strokeDasharray: x.d, strokeDashoffset: x.o }} />
        ))}
        <circle cx="50" cy="50" r="42" transform="rotate(-90 50 50)" style={{ fill: "none", stroke: p.accent ?? "#FF5A1F", strokeWidth: sw, strokeDasharray: fillDash, strokeDashoffset: off, transition: "stroke-dasharray 520ms cubic-bezier(.2,.8,.2,1)" }} />
        <circle cx="50" cy="50" r={rr} transform="rotate(-90 50 50)" style={{ fill: "none", stroke: "#1F7F7E", strokeWidth: hw, strokeDasharray: resDash, strokeDashoffset: resOff }} />
        <path d={hollowD} style={{ fill: "none", stroke: p.hollowInk ?? "#2A1911", strokeWidth: hw, strokeLinejoin: "round" }} />
      </svg>
    </div>
  );
}
