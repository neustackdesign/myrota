"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * Behaviour of the Landing (1) design, ported from its DCLogic class:
 * scroll-tracked chapter nav and tone, hero ring fill, TU chip launch, WE
 * pinned four-step story, TH auto-playing day slots, FR Mix chooser, SA
 * ticker, FAQ accordion, footer wordmark fill, mobile CTA dock, parallax and
 * reveal. Reduced motion disables every timer-driven animation.
 *
 * Truth edits versus the source (see docs/DESIGN_DIFF_AND_CONTRACT.md):
 * - CTAs enter the real PWA at /app (source/pair carried in the URL).
 * - WhatsApp messages share this deployment's real public URL, never a
 *   fixture invite token; friend pairing is not live in the pilot.
 * - FAQ answers describe what the pilot actually does today.
 * - Mix verdicts remain illustrative and are labelled as such.
 */

type State = {
  w: number; vh: number; ch: number; navDark: boolean; dock: boolean; weStep: number; weAnim: boolean;
  slot: number; slotEp: number; paused: boolean; thAnim: boolean; a: string | null; b: string | null;
  faq: number; tuN: number; node: string | null; tick: number; expand: boolean; wmN: number; hover: number;
  heroN: number; mq: boolean; mixMore: boolean;
};

const CH_NAMES: [string, string][] = [["MO", "Shelf"], ["TU", "Add"], ["WE", "Week"], ["TH", "Day"], ["FR", "Mix"], ["SA", "Friends"], ["SU", "Start"]];
const WEEK: [string, string, string][] = [["Mo", "Retinoid", "Cleanser · Retinol 0.3% · Moisturiser"], ["Tu", "Recovery", "Cleanser · Moisturiser"], ["We", "Exfoliant", "Cleanser · BHA 2% · Moisturiser"], ["Th", "Recovery", "Cleanser · Moisturiser"], ["Fr", "Retinoid", "Cleanser · Retinol 0.3% · Moisturiser"], ["Sa", "Rest", "Nothing scheduled"], ["Su", "Recovery", "Cleanser · Moisturiser"]];
const TAG: Record<string, [string, string, string]> = { Retinoid: ["#1E3A3C", "#FBFAF6", "none"], Exfoliant: ["#1F7F7E", "#FBFAF6", "none"], Recovery: ["#9ED8CF", "#2A1911", "none"], Rest: ["#E3F1EC", "#2A1911", "inset 0 0 0 1px rgba(42,25,17,.14)"] };

export const FAQ_LIST = [
  { q: "Do I need an account?", a: "No. Your rota starts as a guest profile on this device when you add your first product. Saving it to an account, so you can sign in on another phone, isn't switched on in this pilot yet. Until it is, your rota lives with this browser." },
  { q: "Do I have to install an app?", a: "No. myrota works in your phone's browser, and you can add it to your home screen. Reminders aren't switched on in this pilot yet, so myrota won't send notifications." },
  { q: "What if I miss a night?", a: "Nothing moves. Missed sessions never pile onto the next day. Each seven-day rota is designed to include one Rescue to cover a missed day; Rescue is still being connected in this pilot, so a missed day currently shows as missed." },
  { q: "What do my friends see?", a: "Your ring and your streak. Never your products, your steps or your routine. Friend Streaks aren't switched on in this pilot yet; for now you can share myrota itself." },
  { q: "Is this medical advice?", a: "No. myrota gives general information about ordering and spacing products you already own. Until a pharmacist has reviewed a rule, myrota won't schedule strong actives such as retinoids or exfoliants: they stay on your shelf, out of the rota. If you use a prescription treatment, check with a professional." },
  { q: "What if a product isn't recognised?", a: "It stays marked unknown. myrota leaves it out of every check and places it only where you put it: morning, evening or not in the rota." },
];

const PRODUCTS = [{ id: "ret", name: "Retinoid" }, { id: "bha", name: "BHA exfoliant" }, { id: "vitc", name: "Vitamin C" }, { id: "niac", name: "Niacinamide" }, { id: "moist", name: "Moisturiser" }, { id: "spf", name: "SPF" }, { id: "rx", name: "Prescription cream" }, { id: "unknown", name: "Something unlabelled" }];
type Verdict = { kind: string; k: string; t1: string; t2: string; body: string };
const VERDICTS: Record<string, Verdict> = {
  "bha+ret": { kind: "Alternate days", k: "turns", t1: "These two", t2: "take turns, never together.", body: "myrota puts them on different nights, with a recovery night between." },
  "ret+vitc": { kind: "Different sessions", k: "sessions", t1: "Morning", t2: "and night, never both.", body: "Vitamin C goes in the morning, the retinoid at night. Never the same session." },
  "bha+vitc": { kind: "Different sessions", k: "sessions", t1: "Morning", t2: "and night, never both.", body: "Vitamin C goes in the morning, the exfoliant at night." },
  "niac+ret": { kind: "Same night", k: "fine", t1: "Same night", t2: "works fine for these.", body: "Niacinamide sits before the retinoid in the evening order." },
  "niac+vitc": { kind: "Same session", k: "fine", t1: "Same morning", t2: "works fine for these.", body: "Both go in the morning, vitamin C first." },
};
function verdict(a: string | null, b: string | null): Verdict {
  if (!a && !b) return { kind: "Pick two", k: "empty", t1: "Pick any two.", t2: "", body: "Choose any two and see what myrota would do with them." };
  if (!a || !b) return { kind: "One more", k: "empty", t1: "Pick one more.", t2: "", body: "A verdict needs a pair." };
  if (a === "rx" || b === "rx") return { kind: "Check with a professional", k: "pro", t1: "Ask first,", t2: "then plan your nights.", body: "Prescription treatments change what's safe to pair. Check with a professional before combining them." };
  if (a === "unknown" || b === "unknown") return { kind: "Unknown", k: "unknown", t1: "Can't check", t2: "an unlabelled product.", body: "myrota keeps it out of every check and places it only where you put it." };
  return VERDICTS[[a, b].sort().join("+")] || { kind: "Not enough evidence", k: "none", t1: "Not enough evidence", t2: "yet, so kept apart.", body: "myrota doesn't guess. Until this pair has been reviewed, it keeps them in separate sessions." };
}

const INITIAL: State = { w: 1280, vh: 800, ch: 0, navDark: true, dock: false, weStep: 0, weAnim: false, slot: 0, slotEp: 0, paused: false, thAnim: false, a: null, b: null, faq: 0, tuN: 0, node: null, tick: 0, expand: false, wmN: 0, hover: -1, heroN: 0, mq: false, mixMore: false };

export function useLandingVM(): any {
  const [st, setSt] = useState<State>(INITIAL);
  const stRef = useRef(st);
  stRef.current = st;
  const set = useCallback((patch: Partial<State> | ((s: State) => Partial<State>)) => {
    setSt((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);
  const R = useRef<{ still: boolean; T: Record<string, any>; last: number; hidden: HTMLElement[]; thV: boolean; tuPlayed: boolean; wmDone: boolean; sy?: number; origin: string }>({ still: false, T: {}, last: 0, hidden: [], thV: false, tuPlayed: false, wmDone: false, origin: "" });
  const onScrollRef = useRef<() => void>(() => {});

  const armSlot = useCallback(() => {
    const r = R.current;
    clearTimeout(r.T.tha);
    set({ thAnim: false });
    r.T.tha = setTimeout(() => set({ thAnim: true }), r.still ? 0 : 1200);
  }, [set]);
  const stopSlots = useCallback(() => {
    const r = R.current;
    if (r.T.slot) { clearInterval(r.T.slot); delete r.T.slot; }
  }, []);
  const startSlots = useCallback(() => {
    const r = R.current;
    stopSlots();
    if (r.still || stRef.current.paused) return;
    r.T.slot = setInterval(() => {
      set((s) => ({ slot: (s.slot + 1) % 5, slotEp: s.slotEp + 1 }));
      armSlot();
      requestAnimationFrame(() => onScrollRef.current());
    }, 4000);
  }, [armSlot, set, stopSlots]);
  const playTu = useCallback(() => {
    const r = R.current;
    let n = 0;
    const go = () => { n++; set({ tuN: n }); if (n < 7) r.T.tu = setTimeout(go, r.still ? 0 : 650); };
    r.T.tu = setTimeout(go, r.still ? 0 : 300);
  }, [set]);

  const onScroll = useCallback(() => {
    const r = R.current, s = stRef.current, vh = window.innerHeight, upd: Partial<State> = {};
    if (r.hidden.length) r.hidden = r.hidden.filter((el) => { if (el.getBoundingClientRect().top < vh * 0.92) { el.style.opacity = "1"; el.style.translate = "0 0"; return false; } return true; });
    let ch = s.ch, tone = "dark";
    for (const sec of Array.from(document.querySelectorAll<HTMLElement>("[data-ch]"))) {
      const rc = sec.getBoundingClientRect();
      if (rc.top <= vh * 0.5 && rc.bottom > vh * 0.5) ch = +(sec.getAttribute("data-ch") ?? 0);
      if (rc.top <= 32 && rc.bottom > 32) tone = sec.getAttribute("data-tone") ?? "dark";
    }
    const navDark = tone === "dyn" ? s.slot >= 2 : tone === "dark";
    if (ch !== s.ch) upd.ch = ch;
    if (navDark !== s.navDark) upd.navDark = navDark;
    const cta = document.querySelector("[data-hero-cta]");
    const dock = !!(cta && cta.getBoundingClientRect().bottom < 56) && ch !== 6;
    if (dock !== s.dock) upd.dock = dock;
    const pin = document.querySelector("[data-we-pin]");
    if (pin) {
      const rc = pin.getBoundingClientRect(), span = Math.max(1, rc.height - vh);
      const p = Math.min(0.999, Math.max(0, -rc.top / span)), step = Math.floor(p * 4);
      if (step !== s.weStep) {
        upd.weStep = step; upd.weAnim = false;
        clearTimeout(r.T.we);
        r.T.we = setTimeout(() => set({ weAnim: true }), r.still ? 0 : 700);
      }
    }
    const vis = (id: string) => { const el = document.getElementById(id); if (!el) return false; const rc = el.getBoundingClientRect(); return rc.top < vh * 0.65 && rc.bottom > vh * 0.35; };
    const thV = vis("th");
    if (thV && !r.thV) { upd.slot = 0; upd.slotEp = s.slotEp + 1; armSlot(); startSlots(); }
    if (!thV && r.thV) stopSlots();
    r.thV = thV;
    if (!r.tuPlayed && vis("tu")) { r.tuPlayed = true; playTu(); }
    const saV = vis("sa");
    if (saV && !r.T.tick && !r.still) r.T.tick = setInterval(() => set((x) => ({ tick: x.tick + 1 })), 2400);
    if (!saV && r.T.tick) { clearInterval(r.T.tick); delete r.T.tick; }
    const foot = document.querySelector("[data-foot]");
    if (foot && !r.wmDone && foot.getBoundingClientRect().top < vh * 0.9) {
      r.wmDone = true;
      let n = 0;
      r.T.wm = setInterval(() => { n++; set({ wmN: n }); if (n >= 7) clearInterval(r.T.wm); }, r.still ? 1 : 80);
    }
    if (!r.still) {
      document.querySelectorAll<HTMLElement>("[data-px]").forEach((el) => {
        const sec = (el.parentElement?.closest("section,header,footer") as HTMLElement | null) || el.parentElement;
        if (!sec) return;
        const rc = sec.getBoundingClientRect();
        const f = +(el.getAttribute("data-px") ?? 1), delta = rc.top + rc.height / 2 - vh / 2;
        el.style.translate = "0 " + Math.max(-90, Math.min(90, (f - 1) * delta * 0.6)).toFixed(1) + "px";
        if (el.hasAttribute("data-blur")) el.style.filter = "blur(" + Math.min(12, Math.max(0, (-rc.top / rc.height) * 24)).toFixed(1) + "px)";
      });
    }
    if (Object.keys(upd).length) set(upd);
  }, [armSlot, playTu, set, startSlots, stopSlots]);
  onScrollRef.current = onScroll;

  useEffect(() => {
    const r = R.current;
    r.still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    r.origin = window.location.origin;
    const onR = () => { set({ w: document.documentElement.clientWidth || window.innerWidth, vh: window.innerHeight }); requestAnimationFrame(() => onScrollRef.current()); };
    const onS = () => {
      const now = Date.now();
      clearTimeout(r.T.trail);
      if (now - r.last > 40) { r.last = now; onScrollRef.current(); }
      else r.T.trail = setTimeout(() => { r.last = Date.now(); onScrollRef.current(); }, 50);
    };
    window.addEventListener("resize", onR);
    window.addEventListener("scroll", onS, { passive: true });
    onR();
    let n = 0;
    r.T.hero = setInterval(() => { n++; set({ heroN: Math.min(4, n) }); if (n >= 4) clearInterval(r.T.hero); }, r.still ? 1 : 80);
    // Reveal: hide below-the-fold [data-reveal] blocks until scrolled into view.
    if (!r.still && "IntersectionObserver" in window) {
      const scan = () => document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "1");
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        const d = +(el.getAttribute("data-reveal-delay") || 0);
        el.style.opacity = "0";
        el.style.translate = "0 24px";
        el.style.transition = `opacity 600ms cubic-bezier(.2,.8,.2,1) ${d}ms, translate 600ms cubic-bezier(.2,.8,.2,1) ${d}ms`;
        r.hidden.push(el);
      });
      r.T.s0 = setTimeout(scan, 160);
    }
    const T = r.T;
    return () => {
      window.removeEventListener("resize", onR);
      window.removeEventListener("scroll", onS);
      Object.values(T).forEach((t) => { clearInterval(t); clearTimeout(t); });
      // Never leave content hidden if the page unmounts mid-reveal.
      r.hidden.forEach((el) => { el.style.opacity = "1"; el.style.translate = "0 0"; });
    };
  }, [set]);

  const goCh = useCallback((i: number) => {
    const el = document.querySelector<HTMLElement>('[data-ch="' + i + '"]');
    if (!el) return;
    const off = i === 0 ? 0 : 40;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: R.current.still ? "auto" : "smooth" });
  }, []);
  const goSlot = useCallback((i: number) => {
    set((s) => ({ slot: i, slotEp: s.slotEp + 1 }));
    armSlot();
    if (R.current.T.slot) startSlots();
  }, [armSlot, set, startSlots]);
  const pick = useCallback((id: string) => set((s) => {
    if (s.a === id) return { a: s.b, b: null };
    if (s.b === id) return { b: null };
    if (!s.a) return { a: id };
    return { b: id };
  }), [set]);

  return useMemo(() => buildVals(st, { set, goCh, goSlot, pick, stopSlots, startSlots, still: R.current.still, origin: R.current.origin }), [st, set, goCh, goSlot, pick, stopSlots, startSlots]);
}

function roll(v: number | string, k: string, still: boolean): ReactNode {
  return <span key={k + v} style={{ display: "inline-block", animation: still ? "none" : "lp-roll 420ms cubic-bezier(.3,1.6,.5,1) both" }}>{v}</span>;
}
function bar(key: string, ms: number, run: boolean, color: string): ReactNode {
  return <span key={key} style={{ position: "absolute", inset: 0, background: color, transformOrigin: "left center", animation: run ? "lp-fill " + ms + "ms linear forwards" : "none", transform: run ? undefined : "scaleX(0)" }} />;
}
function btn(label: string, done: boolean, doneText: string, still: boolean): ReactNode {
  return done ? (
    <div key="d" style={{ minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#5A3824", animation: still ? "none" : "lp-rise 220ms cubic-bezier(.2,.8,.2,1) both" }}>{doneText}</div>
  ) : (
    <div key="b" aria-hidden="true" style={{ minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#EE6F3E", color: "#2A1911", border: "2px solid #2A1911", borderRadius: 999, fontWeight: 600, fontSize: 16, boxShadow: "3px 4px 0 #2A1911" }}>{label}</div>
  );
}
function marquee(paused: boolean, still: boolean): ReactNode {
  const items: [string, string][] = [["Mo", "Retinoid"], ["Tu", "Recovery"], ["We", "Exfoliant"], ["Th", "Recovery"], ["Fr", "Retinoid"], ["Sa", "Rest"], ["Su", "Recovery"], ["Every morning", "SPF"]];
  const run = (k: string) => items.map(([d, t], i) => (
    <span key={k + i} aria-hidden={k === "b" ? true : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0 20px", fontSize: 20, whiteSpace: "nowrap", color: "#FBFAF6" }}>
      {d}
      <span style={{ background: t === "SPF" ? "#FFE3B3" : TAG[t][0], color: t === "SPF" ? "#2A1911" : TAG[t][1], boxShadow: t === "Retinoid" ? "inset 0 0 0 1px rgba(251,250,246,.35)" : "none", borderRadius: 999, padding: "4px 12px", fontSize: 20, lineHeight: 1.1 }}>{t}</span>
      <span aria-hidden="true" style={{ color: "rgba(251,250,246,.4)", paddingLeft: 10 }}>·</span>
    </span>
  ));
  return <div style={{ display: "flex", alignItems: "center", width: "max-content", animation: still ? "none" : "lp-marquee 40s linear infinite", animationPlayState: paused ? "paused" : "running" }}>{run("a")}{run("b")}</div>;
}
function frag(node: string | null): ReactNode {
  const mono: React.CSSProperties = { fontFamily: "var(--font-geist-mono),ui-monospace,monospace", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#5A3824" };
  const row = (t: string, s: string) => <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #F1E0D2", fontSize: 15 }}><span>{t}</span><span style={{ ...mono, color: "#A9401A" }}>{s}</span></div>;
  const pilot = (t: string) => <span key="pilot" style={{ ...mono, color: "#845535" }}>{t}</span>;
  const F: Record<string, ReactNode[]> = {
    scan: [<span key="l" style={mono}>Scan</span>, <div key="f" style={{ position: "relative", height: 150, borderRadius: 12, background: "#1E3A3C" }}>{["tl", "tr", "bl", "br"].map((c) => <span key={c} style={{ position: "absolute", width: 28, height: 4, borderRadius: 4, background: "#FBFAF6", [c[0] === "t" ? "top" : "bottom"]: 20, [c[1] === "l" ? "left" : "right"]: 20 }} />)}</div>, <span key="n" style={{ fontSize: 14, lineHeight: 1.4 }}>Hold the back label inside the frame. Ingredients read in one shot.</span>, pilot("Pilot: photo reading isn't switched on yet")],
    search: [<span key="l" style={mono}>Search</span>, <div key="i" style={{ border: "1.5px solid #5A3824", borderRadius: 12, padding: "10px 12px", fontSize: 15 }}>gentle clean</div>, row("Gentle Foaming Cleanser", "Add"), row("Gentle Hydrating Cleanser", "Add"), pilot("Pilot: the reviewed library is still empty")],
    paste: [<span key="l" style={mono}>Paste</span>, <div key="p" style={{ background: "#F7EFE7", borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.4, color: "#5A3824", minHeight: 96 }}>Aqua, Glycerin, Niacinamide, Salicylic Acid, Panthenol, Sodium Hyaluronate…</div>, <span key="n" style={{ fontSize: 14 }}>Paste the list from the box or the brand page.</span>, pilot("Live in the pilot")],
    gallery: [<span key="l" style={mono}>Gallery</span>, <div key="g" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} style={{ aspectRatio: "1", borderRadius: 8, background: i === 1 ? "#DDBB9C" : "#F1E0D2", boxShadow: i === 1 ? "inset 0 0 0 2px #2A1911" : "none" }} />)}</div>, <span key="n" style={{ fontSize: 14 }}>Pick a photo of the label you already took.</span>, pilot("Pilot: photo reading isn't switched on yet")],
  };
  return node ? F[node] ?? null : null;
}

function buildVals(st: State, h: { set: (p: Partial<State> | ((s: State) => Partial<State>)) => void; goCh: (i: number) => void; goSlot: (i: number) => void; pick: (id: string) => void; stopSlots: () => void; startSlots: () => void; still: boolean; origin: string }) {
  const { w, ch, a, b } = st, mob = w < 760, desk = !mob, still = h.still;
  const dark = st.navDark;
  const nav = { bg: dark ? "rgba(30,58,60,.82)" : "rgba(251,250,246,.88)", ink: dark ? "#FBFAF6" : "#2A1911", line: dark ? "rgba(251,250,246,.08)" : "rgba(42,25,17,.08)", link: dark ? "#F48A5E" : "#A9401A", h: mob ? "56px" : "64px", btn: mob ? "40px" : "44px" };
  const bars = CH_NAMES.map(([d, n], i) => ({
    label: d + " · " + n.toUpperCase(), cur: i === ch ? "step" : "false", tip: st.hover === i,
    bg: i === ch ? "#EE6F3E" : i < ch ? nav.ink : dark ? "rgba(251,250,246,.3)" : "rgba(90,56,36,.3)",
    go: () => h.goCh(i), over: () => h.set({ hover: i }), out: () => h.set({ hover: -1 }),
  }));
  const toMix = (e?: { preventDefault?: () => void }) => { e?.preventDefault?.(); h.goCh(4); };
  // TU
  const C = ["M110 120 C250 120 330 220 440 310", "M770 120 C630 120 550 220 440 310", "M110 500 C250 500 330 400 440 310", "M770 500 C630 500 550 400 440 310"];
  const chipDefs: [string, number][] = [["Gentle cleanser", 0], ["Vitamin C serum", 1], ["Retinol 0.3%", 2], ["BHA 2%", 3], ["SPF 50", 0], ["Toner from the market", 1]];
  const tuN = st.tuN, tuFilled = Math.max(0, Math.min(5, tuN - 1));
  const tuChips = chipDefs.map(([name, k], i) => {
    const unk = i === 5, launched = tuN >= i + 1, landed = !unk && tuN >= i + 2, marked = unk && tuN >= 7;
    return { name, path: "path('" + C[k] + "')", dist: launched ? (unk ? "40%" : "100%") : "0%", op: landed ? 0 : launched ? 1 : 0, fadeDelay: "0ms", unk: marked, bg: "#FBFAF6", ink: "#2A1911", border: marked ? "1.5px dashed #845535" : "1.5px solid #2A1911" };
  });
  const NP: [string, string, string, number, number][] = [["scan", "Scan", "add", 110, 120], ["search", "Search", "shelf", 770, 120], ["paste", "Paste", "log", 110, 500], ["gallery", "Gallery", "share", 770, 500]];
  const nodes = NP.map(([id, label, icon, x, y]) => ({ label, icon, x, y, on: st.node === id, ring: st.node === id ? "#EE6F3E" : "#2A1911", tap: () => h.set({ node: id }) }));
  const nd = NP.find((n) => n[0] === st.node);
  const fragPos = nd ? { x: nd[3] < 440 ? nd[3] + 48 : nd[3] - 328, y: nd[4] < 300 ? nd[4] + 48 : nd[4] - 300 } : { x: 0, y: 0 };
  const tuScale = Math.min(1, (Math.min(1320, w) - 96) / 880);
  // WE
  const week = WEEK.map(([d, tag, pm]) => { const t = TAG[tag]; return { d, tag, pm, bg: t[0], ink: t[1], edge: t[2] }; });
  const ws = st.weStep, wa = st.weAnim;
  const weItems = [
    { n: "01 · Plan", t: "Strong nights take turns.", b: "Retinoid and exfoliant never share a night. Recovery nights sit between them. Mornings stay the same." },
    { n: "02 · Do", t: "One tap a session.", b: "Not one tap per bottle. Finish morning and evening and the day takes its tone." },
    { n: "03 · Rest", t: "Rest counts.", b: "A recovery night done right is a day kept.", p: "0 products to buy" },
    { n: "04 · Rescue", t: "One Rescue a week.", b: "Missed a night? Use it and the streak holds. Nothing moves. Nothing doubles.", p: "1 Rescue per rota · 0 missed sessions moved" },
  ].map((it, i) => ({ ...it, hasP: !!it.p, on: i === ws, labelInk: i === ws ? "#5A3824" : "rgba(90,56,36,.45)", headInk: i === ws ? "#2A1911" : "rgba(90,56,36,.45)", disp: mob && i !== ws ? "none" : "flex" }));
  const moments = ([["You", "planned the week", "7 nights · Starts Monday"], ["You", "marked morning done", "Day 1 · 07:34"], ["You", "kept Recovery", "Day 4 · 21:20"], ["You", "rescued Thursday", "Day 5 · Rescue used"]] as const)[ws];
  // TH
  const slotDefs = [
    { time: "07:30", label: "Morning", sub: "Three steps. Same every day.", dark: false, on: "rgba(251,250,246,.6)" },
    { time: "12:40", label: "Lunch", sub: "Nothing to do. That's the point.", dark: false, on: "rgba(251,250,246,.6)" },
    { time: "19:50", label: "Reminder", sub: "Planned: a nudge only if tonight isn't done.", dark: true, on: "rgba(251,250,246,.1)" },
    { time: "21:30", label: "Evening", sub: "Wednesday is an exfoliant night.", dark: true, on: "rgba(251,250,246,.1)" },
    { time: "21:42", label: "Done", sub: "The day takes its tone on your ring.", dark: true, on: "rgba(251,250,246,.1)" },
  ];
  const sl = st.slot, cur = slotDefs[sl], slotRun = !st.paused && !still;
  const slots = slotDefs.map((t, i) => ({ ...t, on: i === sl, go: () => h.goSlot(i), bg: i === sl ? cur.on : "transparent", track: cur.dark ? "rgba(251,250,246,.3)" : "rgba(42,25,17,.2)", bar: i === sl ? bar("s" + st.slotEp, 4000, slotRun, cur.dark ? "#FBFAF6" : "#2A1911") : null }));
  const f = (i: number) => (sl === i ? 1 : 0);
  // FR
  const name = (id: string | null) => PRODUCTS.find((x) => x.id === id)?.name;
  const shown = st.mixMore ? PRODUCTS : PRODUCTS.slice(0, 6).concat([a, b].filter((id) => id && PRODUCTS.slice(6).some((p) => p.id === id)).map((id) => PRODUCTS.find((p) => p.id === id)!));
  const chips = shown.map((x) => { const on = x.id === a || x.id === b; return { name: x.name, on, slot: x.id === a ? "A" : "B", pick: () => h.pick(x.id), bg: on ? "#EE6F3E" : "#FBFAF6", border: on ? "2px solid #2A1911" : "1.5px solid #5A3824" }; });
  const v = verdict(a, b);
  const vt = ({ turns: ["#1F7F7E", "#FBFAF6", "none"], sessions: ["#F6B48F", "#2A1911", "none"], fine: ["#9ED8CF", "#2A1911", "none"], unknown: ["transparent", "#845535", "inset 0 0 0 1.5px #845535"], none: ["#F1E0D2", "#5A3824", "none"], empty: ["#E3F1EC", "#2A1911", "inset 0 0 0 1px rgba(42,25,17,.14)"], pro: ["#845535", "#FBFAF6", "none"] } as Record<string, string[]>)[v.k];
  const pairs = ([["RETINOL + VITAMIN C", "ret", "vitc"], ["RETINOL + BHA", "ret", "bha"], ["NIACINAMIDE + VITAMIN C →", "niac", "vitc"]] as const).map(([label, x, y]) => ({ label, go: () => h.set({ a: x, b: y }) }));
  const vTitleEl = <span key={v.t1 + v.t2} style={{ display: "block", animation: still ? "none" : "lp-rise 320ms cubic-bezier(.2,.8,.2,1) both" }}><span style={{ display: "block" }}>{v.t1}</span><span style={{ display: "block", color: "rgba(42,25,17,.55)" }}>{v.t2}</span></span>;
  // SA ticker — illustrative moments only (no real friend activity is shown).
  const TK: [string, string, string, number, number, string][] = [["Ama", "marked evening done", "Day 12 · 21:40", 5, -1, ""], ["Jonah", "rescued Tuesday", "Day 4 · Rescue used", 3, -1, "1"], ["Sade", "joined from your link", "Day 1 · building her rota", 0, 0, ""], ["You and Ama", "hit 30 days", "Friend streak", 7, -1, ""]];
  const pos: [number, number][] = [[0, 1], [-24, 0], [-48, 0], [24, 0]];
  const ticker = TK.map(([nm, what, meta, filled, hollow, rescued], i) => { const s = (((st.tick - i) % 4) + 4) % 4, [y, op] = pos[s]; return { name: nm, what, meta, filled, hollow, rescued, op, tf: "translateY(" + y + "px)" }; });
  const faqs = FAQ_LIST.map((q, i) => { const open = st.faq === i; return { ...q, open, sign: open ? "−" : "+", toggle: () => h.set((s) => ({ faq: s.faq === i ? -1 : i })) }; });
  const pad = mob ? 16 : Math.min(48, w * 0.04), wmSize = Math.round(((Math.min(1320, w) - pad * 2) * (mob ? 0.8 : 0.64)) / 3.6);
  const wmTones = Array.from({ length: 7 }, (_, i) => (i < st.wmN ? "#2A1911" : "rgba(42,25,17,.18)")).join(",");
  const publicUrl = (h.origin || "") + "/app";
  const waMsg = "I'm building a skincare rota from what's already on my shelf. Build yours: " + publicUrl;
  const ringWin = mob ? 88 : 132;
  const mixPairHref = a && b ? `/app/mix?a=${encodeURIComponent(name(a) ?? "")}&b=${encodeURIComponent(name(b) ?? "")}&src=landing-mix` : "/app/mix?src=landing-mix";
  return {
    desk, mob, nav, bars, toMix, navLinkDark: desk && dark, navLinkLight: desk && !dark, appHref: "/app?src=landing",
    mixPairHref, publicUrlLabel: publicUrl.replace(/^https?:\/\//, ""),
    waHref: "https://wa.me/?text=" + encodeURIComponent(waMsg),
    waShareHref: "https://wa.me/?text=" + encodeURIComponent("Mix Check: " + (name(a) || "") + " + " + (name(b) || "") + ". Check your own pair: " + (h.origin || "") + "/app/mix"),
    heroPad: mob ? "88px 16px 48px" : "120px clamp(16px,4vw,48px) 96px",
    heroCols: mob ? "minmax(0,1fr)" : "repeat(12,minmax(0,1fr))",
    heroH1Col: mob ? "1 / -1" : "1 / 11", heroFrameCol: mob ? "1 / -1" : "8 / 13", heroFrameRow: mob ? "2" : "1 / 3", heroFrameTop: mob ? "-24px" : "120px",
    heroCopyCol: mob ? "1 / -1" : "1 / 8", heroCopyRow: mob ? "3" : "2", heroCopyTop: mob ? "40px" : "48px",
    ringWin, ringWinIn: ringWin - 18, ringOff: mob ? "-12px" : "-32px", ringNum: mob ? "28px" : "40px", momentLeft: "20px",
    heroFilled: st.heroN, heroHollow: st.heroN >= 4 ? 4 : -1,
    bandH: mob ? "56vh" : "70vh", marquee: marquee(st.mq, still), mqPause: () => h.set({ mq: true }), mqPlay: () => h.set({ mq: false }),
    chPad: mob ? "112px 16px" : "200px clamp(16px,4vw,48px)",
    tuW: Math.round(880 * tuScale), tuH: Math.round(620 * tuScale), tuScale, tuChips, nodes, nodeOpen: !!st.node, frag: fragPos, fragEl: frag(st.node), closeNode: () => h.set({ node: null }),
    tuFilled, tuRoll: roll(tuFilled, "tu", still), tuUnk: tuN >= 7, tuUnkN: tuN >= 7 ? 1 : 0,
    weTopPad: mob ? "112px 16px 16px" : "200px clamp(16px,4vw,48px) 24px", weH: mob ? "320vh" : "360vh", wePinPad: mob ? "64px 16px 16px" : "72px clamp(16px,4vw,48px) 32px",
    weCols: mob ? "minmax(0,1fr)" : "minmax(0,5fr) minmax(0,6fr)", weGap: mob ? "16px" : "64px", weItemGap: mob ? "0" : "40px", weHead: mob ? "28px" : "40px", wePaneH: mob ? "58vh" : "min(84vh,720px)",
    weBar: ((ws + 1) / 4) * 100 + "%", weItems,
    weF0: ws === 0 ? 1 : 0, weF1: ws === 1 ? 1 : 0, weF2: ws === 2 ? 1 : 0, weF3: ws === 3 ? 1 : 0,
    we0: ws === 0, we1: ws === 1, we2: ws === 2, we3: ws === 3, week, openWeek: () => h.set({ expand: true }), closeWeek: () => h.set({ expand: false }), expand: st.expand,
    phoneScale: mob ? Math.min(0.78, (st.vh * 0.56) / 600) : Math.min(1, (Math.min(st.vh * 0.84, 720) - 40) / 600),
    weRingN: ws === 1 && wa ? 1 : 0, weHollow: ws === 1 && wa ? -1 : 0, weStreakEl: roll(ws === 1 && wa ? 1 : 0, "ws", still),
    weDockEl: btn("Mark morning done", ws === 1 && wa, "Morning done · Evening from 20:00", still),
    weDock2El: btn("Mark evening done", ws === 2 && wa, "Recovery night done. Day 4 kept.", still),
    weMissed: ws === 3 && wa ? "" : "3", weRescued: ws === 3 && wa ? "1,3" : "1", weStreak3El: roll(ws === 3 && wa ? 4 : 3, "w3", still),
    weBannerT: ws === 3 && wa ? "Thursday rescued." : "You missed Thursday.", weBannerB: ws === 3 && wa ? "Your streak holds. Tonight stays a retinoid night." : "Use your Rescue today and the streak holds.",
    weDock3El: btn("Use Rescue", ws === 3 && wa, "Rescue used · 1 of 1 this rota", still),
    weMomentEl: (
      <div key={"wm" + ws + (wa ? "a" : "")} style={{ animation: still ? "none" : "lp-rise 500ms cubic-bezier(.2,.8,.2,1) both", display: wa ? "block" : "none" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#FBFAF6", borderRadius: 18, padding: "10px 14px", boxShadow: "0 16px 40px -12px rgba(42,25,17,.28)", whiteSpace: "nowrap", color: "#2A1911" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#E8CDB9", display: "grid", placeItems: "center", fontFamily: "var(--font-faculty-glyphic),serif", fontSize: 14, boxShadow: "inset 0 0 0 2px #FBFAF6, 0 0 0 2px #C99A72" }}>K</span>
          <span style={{ fontSize: 14 }}><b style={{ fontWeight: 600 }}>{moments[0]}</b>{" " + moments[1]}</span>
          <span style={{ fontFamily: "var(--font-geist-mono),ui-monospace,monospace", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#5A3824" }}>{moments[2]}</span>
        </div>
      </div>
    ),
    thInk: cur.dark ? "#FBFAF6" : "#2A1911", thLink: cur.dark ? "#F48A5E" : "#A9401A", thF0: f(0), thF1: f(1), thF2: f(2), thF3: f(3), thF4: f(4), slots,
    th0: sl === 0, th1: sl === 1, th2: sl === 2, th3: sl === 3, th4: sl === 4, th0N: sl === 0 && st.thAnim ? 1 : 0, th0H: sl === 0 && st.thAnim ? -1 : 0,
    th0Dock: btn("Mark morning done", sl === 0 && st.thAnim, "Morning done · Evening from 20:00", still), th4N: sl === 4 && st.thAnim ? 4 : 3,
    inset0: sl === 0 && desk ? 1 : 0, inset0y: sl === 0 ? "0px" : "16px", inset2: sl === 2 && desk ? 1 : 0, inset2y: sl === 2 ? "0px" : "16px",
    pauseLabel: st.paused || still ? "Play the day" : "Pause the day",
    togglePause: () => { const next = !st.paused; h.set({ paused: next }); if (next) h.stopSlots(); else setTimeout(h.startSlots, 0); },
    chips, pairs, aName: name(a) || "Pick a product", bName: name(b) || "Pick another", aInk: a ? "#2A1911" : "#845535", bInk: b ? "#2A1911" : "#845535",
    vKind: v.kind, vTitleEl, vBody: v.body, vBg: vt[0], vInk: vt[1], vEdge: vt[2], hasVerdict: !!(a && b),
    mixShell: v.k === "none" || v.k === "unknown" ? 1 : 0, mixSkin: v.k === "pro" ? 1 : 0,
    mixMoreOn: !st.mixMore, mixMoreGo: () => h.set({ mixMore: true }),
    lpDays: WEEK.map(([d, tag, pm]) => ({ d, long: ({ Mo: "Monday", Tu: "Tuesday", We: "Wednesday", Th: "Thursday", Fr: "Friday", Sa: "Saturday", Su: "Sunday" } as Record<string, string>)[d], type: tag, steps: tag === "Rest" ? "" : pm.replace(/ · /g, ", ") })), xScale: mob ? 1 : 1.6,
    ticker, faqs,
    wmSize, wmTones, wmW: mob ? "80%" : "64%", fZoneB: mob ? "220px" : "360px",
    fCols: mob ? "minmax(0,1fr)" : "minmax(0,4fr) minmax(0,8fr)", fGap: mob ? "40px" : "24px", fLinkCols: mob ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", fLinkGap: mob ? "32px 24px" : "0",
    fColPad: mob ? "0" : "0 0 0 24px", fColLine: mob ? "0" : "1px solid #F1E0D2", fColTop: mob ? "0" : "0",
    dockY: st.dock ? "0" : "120%",
    trackCta: (where: string) => () => track("cta_start", { where }),
  };
}
