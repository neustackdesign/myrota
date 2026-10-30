/**
 * Grain field generator — a verbatim port of the Brand v4 `Grain.dc.html`
 * component (Claude Design source, Landing (1) / Prototype v1.6). Produces an
 * SVG data URI for a given preset and pixel size. Pure: no DOM access.
 */

type Pt = [number, number];
type Stop = [number, string];
interface Grad { a?: Pt; b?: Pt; x?: number; y?: number; r?: number; s: Stop[] }
type Paint = string | Grad;
type Blob = [string | [string, string], number, number, number, number, ("h" | undefined)?];
interface Layer { t: "s" | "p" | "c" | "l"; c: Paint; w?: number; pts?: Pt[]; blur?: number; o?: number; x?: number; y?: number; r?: number; id?: string; clip?: string; n?: number; dx?: number; dy?: number }
interface Preset {
  bg: string;
  bgg?: Grad;
  blobs?: Blob[];
  streaks?: { c: string; w: number; pts: Pt[] }[];
  dots?: { c: string; gap?: number };
  layers?: Layer[];
  fn?: "halo";
  spray?: number;
  blur?: number;
  dark?: number;
  light?: number;
}

export type GrainPreset =
  | "cover" | "lagoon" | "dusk" | "tide" | "rinse" | "sunrise" | "evening" | "streak" | "sun"
  | "skin" | "sea" | "dots" | "mono" | "dune" | "swirl" | "fold" | "halo" | "petal";

const E = "#EE6F3E", A = "#F6B48F", D = "#1E3A3C", K = "#2A1911", P = "#F7EFE7", W = "#FBFAF6", Sh = "#F1E0D2", RS = "#E8CDB9", S = "#DDBB9C", H = "#C99A72", U = "#5A3824", Dw = "#E3F1EC", SG = "#9ED8CF", T = "#1F7F7E", L = "#3E63D8";

export const GRAIN_PRESETS: Record<GrainPreset, Preset> = {
  cover: { bg: P, blobs: [[SG, .02, -.08, .42, .55], [Dw, .25, .15, .3, .3], [RS, .55, .85, .3, .25], [A, .78, .92, .38, .42], [E, .97, 1.12, .42, .5]], spray: .07, dark: .35, light: .4 },
  lagoon: { bg: L, blobs: [[D, .06, .16, .44, .5], [K, .1, .08, .22, .26], [D, .42, .02, .3, .22], [D, .12, .9, .34, .36], [E, .92, .9, .42, .5], [A, .82, .7, .2, .22], [E, .7, .98, .18, .16]], spray: .11, dark: .6, light: .4 },
  dusk: { bg: L, blobs: [[D, .12, .72, .36, .6], [K, .18, .8, .2, .3], [E, .38, .02, .26, .28], [D, .48, .6, .16, .28], [A, .82, .12, .3, .3], [E, .88, .9, .45, .5], [A, .62, .4, .08, .1]], spray: .11, dark: .6, light: .4 },
  tide: { bg: E, blobs: [[T, .78, .28, .5, .4], [D, .9, .62, .3, .38], [SG, .66, .24, .16, .1], [A, .1, .98, .42, .3], [L, .32, .3, .18, .14]], spray: .12, dark: .4, light: .5 },
  rinse: { bg: L, blobs: [[W, .45, .18, .3, .1], [SG, .62, .55, .34, .13], [W, .82, .48, .22, .14], [E, .15, .62, .32, .36], [A, .98, .88, .25, .3], [T, .2, .28, .22, .1]], spray: .13, dark: .3, light: .5 },
  sunrise: { bg: P, blobs: [[Sh, .5, .35, .9, .28], [A, .5, .75, .95, .26], [E, .5, 1.06, 1, .3]], spray: .04, blur: .1, dark: .2, light: .5 },
  evening: { bg: D, blobs: [[K, .5, -.02, .9, .38], [T, .62, .7, .6, .3], [A, .35, 1.05, .5, .22]], spray: .06, blur: .1, dark: .3, light: .6 },
  streak: { bg: A, blobs: [[E, 0, .4, .42, .7], [E, 1, .72, .38, .55], ["#F8C9A8", .7, .15, .35, .3]], streaks: [{ c: W, w: .012, pts: [[.46, -.05], [.38, .28], [.5, .55], [.42, .82], [.47, 1.05]] }, { c: W, w: .006, pts: [[.6, -.05], [.56, .25], [.62, .5]] }], spray: .03, dark: .2, light: .5 },
  sun: { bg: W, blobs: [[Sh, .5, .5, .5, .5], [[A, E], .5, .5, .24, .24, "h"]], spray: .03, blur: .12, dark: .45, light: .2 },
  skin: { bg: RS, blobs: [[Sh, .18, .2, .5, .4], [S, .82, .72, .5, .5], [H, .92, .98, .3, .3], [P, .4, .5, .25, .3]], spray: .07, dark: .4, light: .4 },
  sea: { bg: Dw, blobs: [[SG, .22, .75, .45, .4], [W, .72, .22, .4, .3], [T, .98, 1.02, .25, .25]], spray: .08, dark: .3, light: .4 },
  dots: { bg: K, blobs: [[U, .5, .5, .5, .45]], dots: { c: Sh, gap: 5 }, spray: 0, dark: 0, light: .3 },
  mono: { bg: W, blobs: [[S, 0, 0, .35, .38], [S, 1, 1.02, .45, .4], [RS, 1, 0, .3, .3]], spray: .06, dark: 1, light: 0 },
  dune: { bg: "#F2A26C", bgg: { a: [0, 0], b: [.3, 1], s: [[0, "#FAD3B0"], [.4, "#F4AE78"], [.62, "#E58447"], [1, "#B5501F"]] }, layers: [
    { t: "s", c: "#FCE0C4", w: .16, pts: [[-.2, .36], [.25, .31], [.6, .22], [1.2, .06]], blur: .07, o: .7 },
    { t: "p", c: "#C25A26", pts: [[-.2, .56], [.2, .5], [.55, .47], [.85, .4], [1.2, .3], [1.2, 1.2], [-.2, 1.2]], blur: .05, o: .55 },
    { t: "s", c: "#FBD2AC", w: .05, pts: [[-.2, .52], [.2, .465], [.55, .44], [.85, .37], [1.2, .27]], blur: .028, o: .6 },
    { t: "s", c: "#E4793E", w: .07, pts: [[-.2, .72], [.3, .66], [.7, .6], [1.2, .52]], blur: .04, o: .55 },
    { t: "p", c: "#7E3313", pts: [[-.2, .84], [.3, .76], [.65, .72], [1.2, .62], [1.2, 1.2], [-.2, 1.2]], blur: .07, o: .6 }], spray: .05, dark: .75, light: .45 },
  swirl: { bg: "#F0764F", layers: [
    { t: "s", c: "#CF3F37", w: .36, pts: [[-.1, .02], [.4, .1], [.8, .24], [1.15, .46]], blur: .07, o: .85 },
    { t: "s", c: "#F9A983", w: .16, pts: [[-.15, .32], [.3, .25], [.75, .38], [1.1, .62]], blur: .06, o: .9 },
    { t: "s", c: "#D24A3E", w: .14, pts: [[.22, .5], [.5, .41], [.85, .5], [1.1, .74]], blur: .07, o: .75 },
    { t: "s", c: "#F8A07C", w: .22, pts: [[-.15, .6], [.3, .7], [.7, .68], [1.1, .84]], blur: .09, o: .7 },
    { t: "p", c: "#E25E45", pts: [[-.2, .88], [.4, .96], [1.2, .9], [1.2, 1.2], [-.2, 1.2]], blur: .08, o: .6 }], spray: .02, dark: .85, light: .7 },
  fold: { bg: "#F7843A", layers: [
    { t: "s", c: "#FB9C50", w: .24, pts: [[-.1, .24], [.4, .16], [.85, .3], [.96, .65], [.75, 1.08]], blur: .06, o: .9 },
    { t: "p", c: "#D9481D", pts: [[.28, .98], [.24, .52], [.44, .3], [.72, .38], [.8, .66], [.6, .98]], blur: .07, o: .9 },
    { t: "p", c: "#C43A18", pts: [[.38, .86], [.36, .5], [.5, .38], [.62, .5], [.55, .82]], blur: .08, o: .6 },
    { t: "s", c: "#B9341A", w: .035, pts: [[.36, .44], [.33, .7], [.2, 1.06]], blur: .015, o: .6 },
    { t: "p", c: "#CF3E1C", pts: [[.82, -.1], [1.2, -.1], [1.2, .42], [1.02, .16]], blur: .06, o: .8 },
    { t: "p", c: "#CF3E1C", pts: [[1.2, .74], [.84, 1.12], [1.2, 1.2]], blur: .06, o: .8 }], spray: .02, dark: .7, light: .7 },
  halo: { bg: "#E0560F", fn: "halo", spray: 0, dark: .06, light: .04 },
  petal: { bg: "#4A1406", bgg: { a: [0, 0], b: [1, 1], s: [[0, "#E9922C"], [.45, "#B5501A"], [1, "#2E0A03"]] }, layers: [
    { t: "c", c: "#F7B347", x: .1, y: .05, r: .7, blur: .15, o: .7 },
    { t: "c", c: "#E77A22", x: .92, y: .1, r: .4, blur: .12, o: .6 },
    { t: "p", id: "pt", c: { a: [.1, .25], b: [.9, 1], s: [[0, "#FBC253"], [.35, "#E88A2A"], [.7, "#9A3A10"], [1, "#3A0D04"]] }, pts: [[.08, 1.2], [.08, .52], [.14, .32], [.36, .25], [.6, .3], [.84, .26], [1.2, .32], [1.2, 1.2]], blur: .004 },
    { t: "l", clip: "pt", c: "#FFD27A", pts: [[-.55, .12], [-.25, .3], [0, .6], [.18, 1.15]], n: 76, dx: .022, dy: -.002, w: .0022, o: .3 },
    { t: "s", c: "#FFD77A", w: .035, pts: [[.08, .62], [.09, .44], [.15, .315], [.36, .25], [.6, .3], [.84, .26], [1.2, .32]], blur: .02, o: .45 },
    { t: "s", c: "#FFE29A", w: .006, pts: [[.08, .62], [.09, .44], [.15, .315], [.36, .25], [.6, .3], [.84, .26], [1.2, .32]], blur: .003, o: .9 }], spray: 0, dark: .3, light: .15 },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function curve(p: Pt[]) {
  let d = `M${round1(p[0][0])} ${round1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += ` C${round1(b[0] + (c[0] - a[0]) / 6)} ${round1(b[1] + (c[1] - a[1]) / 6)} ${round1(c[0] - (e[0] - b[0]) / 6)} ${round1(c[1] - (e[1] - b[1]) / 6)} ${round1(c[0])} ${round1(c[1])}`;
  }
  return d;
}

function paint(c: Paint, id: string, w: number, h: number, m: number): [string, string] {
  if (typeof c === "string") return ["", c];
  const st = c.s.map(([o, col]) => `<stop offset='${o}' stop-color='${col}'/>`).join("");
  if (c.r != null) return [`<radialGradient id='${id}' gradientUnits='userSpaceOnUse' cx='${(c.x ?? 0) * w}' cy='${(c.y ?? 0) * h}' r='${c.r * m}'>${st}</radialGradient>`, `url(#${id})`];
  const a = c.a ?? [0, 0], b = c.b ?? [1, 1];
  return [`<linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='${a[0] * w}' y1='${a[1] * h}' x2='${b[0] * w}' y2='${b[1] * h}'>${st}</linearGradient>`, `url(#${id})`];
}

function layers(P: Preset, w: number, h: number, m: number, f: (n: number) => number): [string, string] {
  let defs = "", out = "";
  (P.layers || []).forEach((Ly, i) => {
    const [gd, fill] = paint(Ly.c, "lg" + i, w, h, m);
    defs += gd;
    let fl = "";
    if (Ly.blur) {
      defs += `<filter id='lb${i}' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${f(Ly.blur * m)}'/></filter>`;
      fl = ` filter='url(#lb${i})'`;
    }
    const op = Ly.o != null ? ` opacity='${Ly.o}'` : "";
    const pts = Ly.pts ? Ly.pts.map(([x, y]) => [x * w, y * h] as Pt) : [];
    if (Ly.t === "c") {
      const g = `cx='${f((Ly.x ?? 0) * w)}' cy='${f((Ly.y ?? 0) * h)}' r='${f((Ly.r ?? 0) * m)}'`;
      out += Ly.w ? `<circle ${g} fill='none' stroke='${fill}' stroke-width='${f(Ly.w * m)}'${op}${fl}/>` : `<circle ${g} fill='${fill}'${op}${fl}/>`;
    } else if (Ly.t === "s") {
      out += `<path d='${curve(pts)}' fill='none' stroke='${fill}' stroke-width='${f((Ly.w ?? 0) * m)}' stroke-linecap='round'${op}${fl}/>`;
    } else if (Ly.t === "l") {
      let g = "";
      for (let k = 0; k < (Ly.n ?? 0); k++) {
        const j = Math.sin(k * 2.3) * 0.004;
        g += `<path d='${curve((Ly.pts ?? []).map(([x, y], q) => [(x + k * (Ly.dx ?? 0) + j * q) * w, (y + k * (Ly.dy ?? 0)) * h] as Pt))}'/>`;
      }
      out += `<g${Ly.clip ? ` clip-path='url(#cp_${Ly.clip})'` : ""} fill='none' stroke='${fill}' stroke-width='${f(Math.max(0.6, (Ly.w ?? 0) * m))}'${op}>${g}</g>`;
    } else {
      const d = curve(pts) + " Z";
      if (Ly.id) defs += `<clipPath id='cp_${Ly.id}'><path d='${d}'/></clipPath>`;
      out += `<path d='${d}' fill='${fill}'${op}${fl}/>`;
    }
  });
  return [defs, out];
}

function halo(w: number, h: number, f: (n: number) => number): [string, string] {
  const s = Math.min(w, 1.25 * h), cx = -0.16 * s, cy = 0.56 * h, R = 0.75 * s;
  const st = (a: [number, string, number?][]) => a.map(([o, c, op]) => `<stop offset='${o}' stop-color='${c}'${op != null ? ` stop-opacity='${op}'` : ""}/>`).join("");
  const rg = (id: string, x: number, y: number, r: number, a: [number, string, number?][]) => `<radialGradient id='${id}' gradientUnits='userSpaceOnUse' cx='${f(x)}' cy='${f(y)}' r='${f(r)}'>${st(a)}</radialGradient>`;
  const lg = (id: string, x1: number, y1: number, x2: number, y2: number, a: [number, string, number?][]) => `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='${f(x1)}' y1='${f(y1)}' x2='${f(x2)}' y2='${f(y2)}'>${st(a)}</linearGradient>`;
  const bl = (id: string, sd: number) => `<filter id='${id}' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${f(sd)}'/></filter>`;
  const defs = rg("hbg", cx, cy, 2.4 * R, [[0, "#FFA01E"], [0.4, "#FF9216"], [0.45, "#F5740E"], [0.57, "#DB540B"], [0.74, "#BB390A"], [1, "#8A2004"]]) +
    rg("hdisc", cx + 0.86 * R, cy - 0.12 * R, 0.68 * R, [[0, "#FFF2D8"], [0.32, "#FFD68C"], [0.68, "#FFAE3A"], [1, "#FF9C20"]]) +
    lg("hrim", cx + 0.25 * R, cy, cx + R, cy - 0.15 * R, [[0, "#FFF2D4", 0], [0.6, "#FFF2D4", 0.4], [1, "#FFF6E0", 0.95]]) +
    lg("hline", cx, cy - 0.85 * R, cx, cy + R, [[0, "#FFF6E2", 0], [0.3, "#FFF6E2", 0.55], [0.5, "#FFF8EA", 1], [1, "#FFF6E2", 0.85]]) +
    bl("hb1", 0.09 * R) + bl("hb2", 0.035 * R) + bl("hb3", 0.012 * R) + bl("hb4", 0.004 * R);
  const C = (r: number) => `cx='${f(cx)}' cy='${f(cy)}' r='${f(r)}'`;
  const out = `<rect width='100%' height='100%' fill='url(#hbg)'/>` +
    `<circle ${C(1.13 * R)} fill='#FF9C1C' opacity='.7' filter='url(#hb1)'/>` +
    `<circle ${C(1.025 * R)} fill='none' stroke='#FFB43C' stroke-width='${f(0.07 * R)}' opacity='.65' filter='url(#hb2)'/>` +
    `<circle ${C(R)} fill='url(#hdisc)' filter='url(#hb4)'/>` +
    `<circle ${C(0.93 * R)} fill='none' stroke='url(#hrim)' stroke-width='${f(0.15 * R)}' filter='url(#hb2)'/>` +
    `<circle ${C(R)} fill='none' stroke='url(#hline)' stroke-width='${f(0.03 * R)}' opacity='.7' filter='url(#hb3)'/>` +
    `<circle ${C(R)} fill='none' stroke='url(#hline)' stroke-width='${f(Math.max(1, 0.006 * R))}'/>`;
  return [defs, out];
}

export function buildGrainSvg(w: number, h: number, P: Preset, sm: number, gm: number, seed: number): string {
  const m = Math.min(w, h), f = round1;
  const blur = f((P.blur ?? 0.08) * m), hb = f(Math.max(1, 0.004 * m));
  const spray = f(Math.min(180, (P.spray ?? 0.09) * m * sm));
  let grads = "", soft = "", hard = "", top = "", dots = "";
  (P.blobs || []).forEach((b, i) => {
    const [c, x, y, rx, ry, k] = b;
    let fill = c as string;
    if (Array.isArray(c)) {
      grads += `<radialGradient id='g${i}' cx='.38' cy='.35' r='.8'><stop offset='0' stop-color='${c[0]}'/><stop offset='1' stop-color='${c[1]}'/></radialGradient>`;
      fill = `url(#g${i})`;
    }
    const isHard = k === "h";
    const e = `<ellipse cx='${f(x * w)}' cy='${f(y * h)}' rx='${f(rx * (isHard ? m : w))}' ry='${f(ry * (isHard ? m : h))}' fill='${fill}'/>`;
    if (isHard) hard += e;
    else soft += e;
  });
  (P.streaks || []).forEach((s) => {
    const d = curve(s.pts.map(([x, y]) => [x * w, y * h] as Pt));
    const sw = s.w * m;
    top += `<path d='${d}' fill='none' stroke='${s.c}' stroke-width='${f(sw * 6)}' stroke-linecap='round' opacity='.4' filter='url(#bm)'/><path d='${d}' fill='none' stroke='${s.c}' stroke-width='${f(sw)}' stroke-linecap='round' filter='url(#bh2)'/>`;
  });
  if (P.dots) {
    const g = P.dots.gap || 5;
    dots = `<defs><pattern id='dp' width='${g}' height='${g}' patternUnits='userSpaceOnUse'><circle cx='${g / 2}' cy='${g / 2}' r='${f(g * 0.2)}' fill='${P.dots.c}'/></pattern><filter id='dw' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${(3 / m).toFixed(4)}' numOctaves='3' seed='${seed}' result='n'/><feDisplacementMap in='SourceGraphic' in2='n' scale='${f(m * 0.18)}' xChannelSelector='R' yChannelSelector='G' result='d'/><feTurbulence type='fractalNoise' baseFrequency='${(2.2 / m).toFixed(4)}' numOctaves='2' seed='${seed + 9}'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3.2 0 0 0 -1.1'/><feComposite in='d' operator='in'/></filter></defs><rect x='-40' y='-40' width='${w + 80}' height='${h + 80}' fill='url(#dp)' filter='url(#dw)'/>`;
  }
  const [ldefs, lout] = P.fn === "halo" ? halo(w, h, f) : layers(P, w, h, m, f);
  grads += ldefs;
  let bgf = P.bg;
  if (P.bgg) {
    const [bd, bf] = paint(P.bgg, "bgg", w, h, m);
    grads += bd;
    bgf = bf;
  }
  const gd = (P.dark ?? 0.5) * gm, gl = (P.light ?? 0.5) * gm;
  const gr = (id: string, c: number[], a: number, b: number, sd: number) => `<filter id='${id}' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='${sd}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${c[0]} 0 0 0 0 ${c[1]} 0 0 0 0 ${c[2]} ${f(a * 100) / 100} 0 0 0 ${f(b * 100) / 100}'/></filter>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><defs>${grads}` +
    `<filter id='bs' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${blur}'/></filter>` +
    `<filter id='bm' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='${f(0.03 * m)}'/></filter>` +
    `<filter id='bh' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='${hb}'/></filter>` +
    `<filter id='bh2' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='${f(0.006 * m)}'/></filter>` +
    `<filter id='sp' x='-5%' y='-5%' width='110%' height='110%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' seed='${seed}' result='n'/><feDisplacementMap in='SourceGraphic' in2='n' scale='${spray}' xChannelSelector='R' yChannelSelector='G'/></filter>` +
    gr("gd", [0.16, 0.1, 0.07], 3.2 * gd, -2.05 * gd, seed + 3) + gr("gl", [1, 0.98, 0.95], -3.2 * gl, 1.2 * gl, seed + 5) +
    `</defs><rect width='100%' height='100%' fill='${bgf}'/><g${spray > 0 ? " filter='url(#sp)'" : ""}><rect x='${f(-w * 0.2)}' y='${f(-h * 0.2)}' width='${f(w * 1.4)}' height='${f(h * 1.4)}' fill='${bgf}'/><g filter='url(#bs)'>${soft}</g><g filter='url(#bh)'>${hard}</g>${lout}${top}</g>${dots}` +
    (gd > 0 ? `<rect width='100%' height='100%' filter='url(#gd)'/>` : "") + (gl > 0 ? `<rect width='100%' height='100%' filter='url(#gl)'/>` : "") + `</svg>`;
}

const cache = new Map<string, string>();

/** CSS background-image value for a preset at a pixel size (sizes snap to 8px, like the source). */
export function grainBackground(preset: string, w: number, h: number, spray = 1, grain = 1, seed = 4): string {
  const name = (preset in GRAIN_PRESETS ? preset : "cover") as GrainPreset;
  if (w <= 0 || h <= 0) return "none";
  const key = [name, w, h, spray, grain, seed].join("|");
  let v = cache.get(key);
  if (!v) {
    v = `url("data:image/svg+xml,${encodeURIComponent(buildGrainSvg(w, h, GRAIN_PRESETS[name], spray, grain, seed))}")`;
    if (cache.size > 64) cache.clear();
    cache.set(key, v);
  }
  return v;
}

export function grainBase(preset: string): string {
  return (GRAIN_PRESETS[preset as GrainPreset] ?? GRAIN_PRESETS.cover).bg;
}
