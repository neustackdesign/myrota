"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientConfigResponse, ExtractionCandidate, MeResponse, MixResponse, MixSubjectRef, TodayResponse } from "../api/contract";
import { ApiError, apiErrorMessage } from "../api/repository";
import { contextNeeds, draftForUnknown, draftFromCatalogue, PROBLEM_TEXT } from "../client/drafts";
import { canPromptInstall, detectPlatform, isStandalone, promptInstall } from "../client/pwa";
import { fitImageForUpload } from "../client/image";
import { newIdempotencyKey, useRepository } from "../client/runtime";
import { countBucket, track } from "../analytics";
import { isAnalysable } from "../domain/evidence";
import { VERDICT_LABEL } from "../domain/mix";
import { buildTodayView, type TodayView } from "../domain/today";
import type { CareAnswer, CatalogueProduct, CompletionSession, ProductCategory, ProductFormat, RetinoidExperience, ShelfProduct, UserPlacement } from "../domain/types";
import {
  CATEGORY_ICON, CATEGORY_LABEL, DONE_TONES, HELD_REASON_TEXT, PROV_LABEL, SEA_GLASS, TRACK,
  dayStatementOf, designDays, designStatus, provenanceOf, sessionsFor, shelfRole, tagOf, toneOf, weekday,
  type DesignDay, type DesignItem, type DesignStatus,
} from "./adapt";

/**
 * Production view-model for the v1.6 screens (components/app/screens.tsx).
 *
 * Owns navigation (URL-synced under /app), transient UI state and the real
 * server data (GET /api/me, /api/config, /api/shelf, /api/today). Computes
 * every binding the generated markup reads, using lib/domain for all
 * calculations. Capabilities the pilot backend does not have are gated with
 * honest copy, never simulated (see CAPABILITIES and
 * docs/PROTOTYPE_TO_PRODUCTION_MATRIX.md).
 */

/** What the deployed Worker actually supports. Flip only with a real endpoint behind it. */
export const CAPABILITIES = {
  photoReading: false,   // POST /api/extract multipart → 501 until the 30-label gate passes
  catalogue: false,      // GET /api/catalogue returns no reviewed results yet
  rescue: false,         // no /api/rotas/:id/rescue
  swap: false,           // no /api/rotas/:id/swap-recovery
  reflect: false,        // no /api/rotas/:id/reflect
  nextWeek: false,       // no /api/rotas/next
  friends: false,        // no invites / pairing / friends endpoints
  reminders: false,      // no VAPID / push backend
  shareImages: false,    // no /api/share image rendering
} as const;

type Screen = "welcome" | "add" | "scan" | "review" | "context" | "building" | "reveal" | "today" | "dayDone" | "shelf" | "friends" | "mix" | "mixResult" | "rotaComplete" | "nextWeek" | "reminders" | "loading" | "error";
type Source = "organic" | "invite" | "mix" | "shelf";

export const SCREEN_PATH: Partial<Record<Screen, string>> = {
  welcome: "", add: "build", context: "build/context", building: "build/progress", reveal: "rota", today: "today", dayDone: "today/done",
  shelf: "shelf", friends: "friends", mix: "mix", mixResult: "mix/result", scan: "add/scan", review: "add/review",
  rotaComplete: "week/complete", nextWeek: "week/next", reminders: "settings/reminders",
};
export function screenForPath(pathname: string): Screen | "entry" | "invite" {
  const sub = pathname.replace(/^\/app\/?/, "").replace(/\/$/, "");
  if (!sub) return "entry";
  if (sub.startsWith("i/")) return "invite";
  const hit = (Object.entries(SCREEN_PATH) as [Screen, string][]).find(([, p]) => p === sub);
  return hit ? hit[0] : "entry";
}
/** Screens that need a rota; anything else is reachable without one. */
const NEEDS_ROTA = new Set<Screen>(["reveal", "today", "dayDone", "rotaComplete", "nextWeek"]);

interface MixPick { ref: MixSubjectRef; name: string; icon: string }
interface Look { skin: number; hair: string; face: string; extra: string; bg: string }

interface UI {
  screen: Screen; hist: Screen[]; phase: "idle" | "out" | "in0"; dir: number;
  sheet: string | null; sheetIn: boolean; toast: string | null; busy: string | null; pop: boolean;
  source: Source; query: string; barcodeOpen: boolean; unkName: string; unkPlace: UserPlacement; unkFromReview: boolean;
  pasteText: string; candidateMethod: "paste" | "scan" | "gallery"; selectedCatalogue: CatalogueProduct | null; candidate: ExtractionCandidate | null; revStep: 1 | 2; revName: string; revCat: ProductCategory | null; revUse: ProductFormat | null;
  corrections: Record<string, string | null>; chipId: string | null; chipDraft: string;
  ctxRet: RetinoidExperience | null; ctxCare: string | null; buildN: number;
  stripSel: number; weekOpen: number; sheetDay: number; prodId: string | null;
  mixA: MixPick | null; mixB: MixPick | null; mixSlot: "a" | "b"; mixResult: MixResponse | null; whyOpen: boolean;
  shareType: "rota" | "mix" | "day3" | "day7"; shareFmt: "story" | "square" | "link"; shareNames: boolean; shareOpts: boolean;
  nameDraft: string; afterName: string | null; platform: "ios" | "android"; reflect: string | null;
  avTab: string; draft: Look | null; look: Look | null;
}
interface Data {
  boot: "loading" | "ready" | "error"; bootError: string | null;
  me: MeResponse | null; config: ClientConfigResponse | null; shelf: ShelfProduct[]; today: TodayResponse | null; skewMs: number;
}

const INITIAL_UI: UI = {
  screen: "loading", hist: [], phase: "idle", dir: 1, sheet: null, sheetIn: false, toast: null, busy: null, pop: false,
  source: "organic", query: "", barcodeOpen: false, unkName: "", unkPlace: "pm", unkFromReview: false,
  pasteText: "", candidateMethod: "paste", selectedCatalogue: null, candidate: null, revStep: 1, revName: "", revCat: null, revUse: null, corrections: {}, chipId: null, chipDraft: "",
  ctxRet: null, ctxCare: null, buildN: 0, stripSel: -1, weekOpen: -1, sheetDay: 0, prodId: null,
  mixA: null, mixB: null, mixSlot: "a", mixResult: null, whyOpen: false,
  shareType: "rota", shareFmt: "story", shareNames: false, shareOpts: false,
  nameDraft: "", afterName: null, platform: "ios", reflect: null, avTab: "skin", draft: null, look: null,
};

const LOOK_KEY = "myrota.look.v1"; // cosmetic avatar look; device-local by design, never user data
const CARE_MAP: Record<string, CareAnswer> = { preg: "pregnant_or_breastfeeding", rx: "prescription_treatment", none: "none", skip: "prefer_not_to_say" };
const CATS: [ProductCategory, string][] = [["cleanser", "Cleanser"], ["toner", "Toner"], ["serum", "Serum"], ["treatment", "Treatment"], ["moisturiser", "Moisturiser"], ["sunscreen", "Sunscreen"]];
const VT: Record<string, [string, string, string]> = { "Alternate days": ["#1F7F7E", "#FBFAF6", "Take turns."], "Better separated": ["#F6B48F", "#2A1911", "Morning and night."], "Fine together": ["#9ED8CF", "#2A1911", "Fine together."], "Not enough evidence": ["#F1E0D2", "#5A3824", "Not enough evidence."], "Check with a professional": ["#845535", "#FBFAF6", "Ask first."] };
const VS: Record<string, [string, string, string, string]> = { "Alternate days": ["These two", "take turns.", "#1F7F7E", "#FBFAF6"], "Better separated": ["Morning", "and night.", "#F6B48F", "#2A1911"], "Fine together": ["Fine", "together.", "#9ED8CF", "#2A1911"], "Not enough evidence": ["Not enough", "evidence.", "#F1E0D2", "#5A3824"], "Check with a professional": ["Ask a", "professional first.", "#845535", "#FBFAF6"] };
const ACTIVE_LABEL: Record<string, string> = { retinoid: "Retinoid", aha: "AHA", bha: "BHA", vitamin_c: "Vitamin C", niacinamide: "Niacinamide", azelaic_acid: "Azelaic acid", benzoyl_peroxide: "Benzoyl peroxide" };
const TAGC: Record<string, [string, string, string]> = { Retinoid: ["#1E3A3C", "#FBFAF6", "none"], Exfoliant: ["#1F7F7E", "#FBFAF6", "none"], Recovery: ["#9ED8CF", "#2A1911", "none"], Rest: ["#E3F1EC", "#2A1911", "inset 0 0 0 1px rgba(42,25,17,.14)"], Daily: ["#F1E0D2", "#2A1911", "none"] };
const AV = { skin: [0, 1, 2, 3, 4, 5, 6, 7, 8], hair: ["lowcut", "bald", "coils", "afro", "puffs", "locs", "braids", "cornrows", "bun", "long", "headwrap", "hijab"], face: ["calm", "smile", "grin", "wink"], extra: ["none", "patches", "mask", "towel", "headband", "glasses", "hoops"], bg: ["dew", "seaglass", "shell", "apricot", "rosesand", "tide"] } as Record<string, (string | number)[]>;
const SK = ["#F5E2D3", "#EED3BE", "#E2C0A3", "#D1A47F", "#B98661", "#9A6B48", "#7C5235", "#5E3B25", "#3D2618"];
const BGC: Record<string, string> = { dew: "#E3F1EC", seaglass: "#9ED8CF", shell: "#F1E0D2", apricot: "#F6B48F", rosesand: "#E8CDB9", tide: "#1F7F7E" };

function hhmm(iso: string | null | undefined, timeZone: string) {
  if (!iso) return "";
  try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso)); } catch { return ""; }
}
function readLook(): Look | null {
  try { const raw = localStorage.getItem(LOOK_KEY); return raw ? (JSON.parse(raw) as Look) : null; } catch { return null; }
}

export function useAppVM() {
  const repo = useRepository();
  const [ui, setUi] = useState<UI>(INITIAL_UI);
  const [data, setData] = useState<Data>({ boot: "loading", bootError: null, me: null, config: null, shelf: [], today: null, skewMs: 0 });
  const [catalogue, setCatalogue] = useState<{ query: string; results: CatalogueProduct[]; busy: boolean; error: string | null }>({
    query: "", results: [], busy: false, error: null,
  });
  const [tick, setTick] = useState(0);
  const uiRef = useRef(ui); uiRef.current = ui;
  const dataRef = useRef(data); dataRef.current = data;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const still = useRef(false);
  const set = useCallback((p: Partial<UI> | ((u: UI) => Partial<UI>)) => setUi((u) => ({ ...u, ...(typeof p === "function" ? p(u) : p) })), []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, still.current ? 0 : ms)); }, []);
  const toast = useCallback((t: string) => { set({ toast: t }); timers.current.push(setTimeout(() => setUi((u) => (u.toast === t ? { ...u, toast: null } : u)), 2600)); }, [set]);
  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.kind === "unauthorized") setData((d) => ({ ...d, me: null }));
    toast(apiErrorMessage(e));
  }, [toast]);

  // ---------------------------------------------------------------- navigation
  const pushUrl = useCallback((screen: Screen, replace = false) => {
    const p = SCREEN_PATH[screen];
    if (p === undefined || typeof window === "undefined") return;
    const url = "/app" + (p ? "/" + p : "") + (screen === "mix" ? window.location.search : "");
    if (window.location.pathname !== url.split("?")[0]) (replace ? history.replaceState : history.pushState).call(history, { screen }, "", url);
  }, []);
  const go = useCallback((to: Screen, dir = 1, extra: Partial<UI> = {}) => {
    set({ phase: "out", dir });
    later(() => {
      setUi((u) => ({ ...u, screen: to, hist: [...u.hist, u.screen].slice(-20), phase: "in0", sheet: null, sheetIn: false, ...extra }));
      pushUrl(to);
      later(() => set({ phase: "idle" }), 30);
      if (to === "dayDone") { set({ pop: true }); later(() => set({ pop: false }), 450); }
    }, 150);
  }, [later, pushUrl, set]);
  const back = useCallback(() => {
    const u = uiRef.current;
    const prev = [...u.hist].reverse().find((s) => s !== "loading" && s !== "error" && s !== "building");
    const fallback: Screen = dataRef.current.today?.rota ? "today" : "welcome";
    set((x) => ({ phase: "out", dir: -1, hist: x.hist.slice(0, -1) }));
    later(() => { set({ screen: prev ?? fallback, phase: "in0" }); pushUrl(prev ?? fallback, true); later(() => set({ phase: "idle" }), 30); }, 150);
  }, [later, pushUrl, set]);
  const openSheet = useCallback((name: string, extra: Partial<UI> = {}) => { set({ sheet: name, sheetIn: false, ...extra }); later(() => set({ sheetIn: true }), 20); }, [later, set]);
  const closeSheet = useCallback((then?: () => void) => { set({ sheetIn: false }); later(() => { set({ sheet: null }); then?.(); }, 300); }, [later, set]);

  // ---------------------------------------------------------------- data
  const loadToday = useCallback(async () => {
    const t0 = Date.now();
    const today = await repo.today();
    const skewMs = today?.serverNow ? new Date(today.serverNow).getTime() - (t0 + Date.now()) / 2 : 0;
    setData((d) => ({ ...d, today, skewMs: Math.abs(skewMs) > 120_000 ? skewMs : 0 }));
    return today;
  }, [repo]);
  const loadShelf = useCallback(async () => {
    const res = await repo.shelf();
    setData((d) => ({ ...d, shelf: res.products }));
    return res.products;
  }, [repo]);

  const boot = useCallback(async () => {
    setData((d) => ({ ...d, boot: "loading", bootError: null }));
    try {
      const [config, me] = await Promise.all([repo.config().catch(() => null), repo.me()]);
      let shelf: ShelfProduct[] = [];
      let today: TodayResponse | null = null;
      if (me) {
        [shelf, today] = await Promise.all([repo.shelf().then((r) => r.products), repo.today()]);
      }
      setData({ boot: "ready", bootError: null, me, config, shelf, today, skewMs: 0 });
      const path = typeof window !== "undefined" ? window.location.pathname : "/app";
      const target = screenForPath(path);
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const src = q.get("src") ?? "direct";
      track("app_open", { src: src.startsWith("landing") ? "landing" : src });
      const hasRota = !!today?.rota;
      let screen: Screen;
      if (target === "invite") {
        screen = hasRota ? "today" : "welcome";
        later(() => toast("Invites aren't switched on in this pilot yet. You can still build your own rota."), 400);
      } else if (target === "entry") {
        screen = hasRota ? "today" : shelf.length ? "add" : "welcome";
      } else if (NEEDS_ROTA.has(target) && !hasRota) {
        screen = shelf.length ? "add" : "welcome";
      } else if (target === "building" || target === "review" || target === "context") {
        screen = hasRota ? "today" : "add";
      } else screen = target;
      const extra: Partial<UI> = {};
      if (screen === "mix") {
        const a = q.get("a"), b = q.get("b");
        if (a && a.length <= 120) extra.mixA = { ref: { kind: "unknown", name: a }, name: a, icon: "jar" };
        if (b && b.length <= 120) extra.mixB = { ref: { kind: "unknown", name: b }, name: b, icon: "jar" };
        extra.source = "mix";
      }
      setUi((u) => ({ ...u, ...extra, screen, phase: "idle", look: readLook(), platform: detectPlatform() === "android" ? "android" : "ios" }));
      pushUrl(screen, true);
    } catch (e) {
      setData((d) => ({ ...d, boot: "error", bootError: apiErrorMessage(e) }));
      set({ screen: "error" });
    }
  }, [later, pushUrl, repo, set, toast]);

  useEffect(() => {
    still.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    boot();
    const onPop = () => {
      const s = screenForPath(window.location.pathname);
      const hasRota = !!dataRef.current.today?.rota;
      const screen: Screen = s === "entry" || s === "invite" ? (hasRota ? "today" : "welcome") : NEEDS_ROTA.has(s) && !hasRota ? "welcome" : s;
      setUi((u) => ({ ...u, screen, sheet: null, sheetIn: false, phase: "idle" }));
    };
    window.addEventListener("popstate", onPop);
    // Re-derive Today every minute (04:00 rollover, evening atmosphere) and refetch when the tab returns.
    const iv = setInterval(() => setTick((t) => t + 1), 60_000);
    const onVis = () => { if (document.visibilityState === "visible" && dataRef.current.me) loadToday().catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    const T = timers.current;
    return () => { window.removeEventListener("popstate", onPop); document.removeEventListener("visibilitychange", onVis); clearInterval(iv); T.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search only when the SERVER has enabled a real catalogue. Ignore stale
  // responses when someone types quickly or navigates to another screen.
  useEffect(() => {
    const query = ui.query.trim();
    const enabled = data.config?.capabilities?.catalogue === true;
    const visible = ui.screen === "add" || ui.sheet === "mixPick";
    if (!enabled || !visible || query.length < 2) {
      setCatalogue({ query: "", results: [], busy: false, error: null });
      return;
    }
    let active = true;
    setCatalogue({ query, results: [], busy: true, error: null });
    const timer = setTimeout(() => {
      repo.searchCatalogue(query).then((res) => {
        if (active) setCatalogue({ query, results: Array.isArray(res.results) ? res.results.slice(0, 10) : [], busy: false, error: null });
      }).catch(() => {
        if (active) setCatalogue({ query, results: [], busy: false, error: "Library search is unavailable. Add this product by name instead." });
      });
    }, 320);
    return () => { active = false; clearTimeout(timer); };
  }, [ui.query, ui.screen, ui.sheet, data.config?.capabilities?.catalogue, repo]);

  // ---------------------------------------------------------------- derived domain view
  const view: TodayView | null = useMemo(() => {
    const t = data.today;
    if (!t?.rota) return null;
    void tick;
    return buildTodayView({ rota: t.rota, rotas: t.rotas, records: t.records, now: new Date(Date.now() + data.skewMs), timeZone: t.timeZone });
  }, [data.today, data.skewMs, tick]);

  // ---------------------------------------------------------------- actions
  const ensureMe = useCallback(async () => {
    if (dataRef.current.me) return;
    const me = await repo.me();
    setData((d) => ({ ...d, me }));
  }, [repo]);

  const addDraft = useCallback(async (draft: Parameters<typeof repo.addProduct>[0], okToast: string) => {
    set({ busy: "add" });
    try {
      await repo.addProduct(draft);
      await ensureMe();
      const products = await loadShelf();
      if (products.length === 1) track("onboarding_product", { method: draft.source === "paste" ? "paste" : "manual" });
      toast(okToast);
      return true;
    } catch (e) { fail(e); return false; } finally { set({ busy: null }); }
  }, [ensureMe, fail, loadShelf, repo, set, toast]);

  const complete = useCallback(async (session: CompletionSession) => {
    const t = dataRef.current.today, v0 = view;
    if (!t?.rota || !v0 || uiRef.current.busy) return;
    set({ busy: "complete" });
    const before = v0.dayComplete;
    try {
      await repo.complete({ rotaId: t.rota.id, skincareDate: v0.skincareDate, session, idempotencyKey: newIdempotencyKey(`complete:${t.rota.id}:${v0.skincareDate}:${session}`) });
      track("session_complete", { session });
      const fresh = await loadToday(); // read back the stored day record, never assume
      const nv = fresh?.rota ? buildTodayView({ rota: fresh.rota, rotas: fresh.rotas, records: fresh.records, now: new Date(), timeZone: fresh.timeZone }) : null;
      toast(session === "am" ? "Morning done" : session === "pm" ? "Evening done" : "Rest day done");
      if (nv && nv.dayComplete && !before) {
        set({ pop: true }); later(() => set({ pop: false }), 400);
        if (nv.dayIndex === 6) later(() => go("rotaComplete"), 900);
        else if (nv.streak.earned === 1 || nv.streak.earned === 3) later(() => go("dayDone"), 900);
        else later(() => toast(`Today's done · ${nv.streak.continuity}-day streak`), 700);
      }
    } catch (e) { fail(e); } finally { set({ busy: null }); }
  }, [fail, go, later, loadToday, repo, set, toast, view]);

  const runBuild = useCallback(async () => {
    const u = uiRef.current;
    set({ buildN: 0 });
    let k = 0;
    const anim = new Promise<void>((resolve) => {
      const iv = setInterval(() => { k++; set({ buildN: Math.min(7, k) }); if (k >= 9) { clearInterval(iv); resolve(); } }, still.current ? 1 : 260);
    });
    try {
      const context = { retinoidExperience: u.ctxRet ?? null, care: u.ctxCare ? CARE_MAP[u.ctxCare] : null };
      await Promise.all([repo.createRota({ context, idempotencyKey: newIdempotencyKey("rota") }), anim]);
      await loadToday();
      track("onboarding_rota", { bucket: countBucket(dataRef.current.shelf.length) });
      go("reveal", 1, { ctxRet: null, ctxCare: null }); // private context is transient: dropped once sent
    } catch (e) { await anim; fail(e); go("add", -1); }
  }, [fail, go, loadToday, repo, set]);

  // ---------------------------------------------------------------- the view-model
  const v = useMemo(() => {
    const u = ui, d = data;
    const shelfAll = d.shelf, shelf = shelfAll.filter((p) => !p.finishedAt);
    const rota = d.today?.rota ?? null;
    const days: DesignDay[] = rota ? designDays(rota) : [];
    const tz = d.today?.timeZone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
    const di = view ? view.dayIndex : -1;
    const isPM = view ? view.atmosphere === "pm" : false;
    const DOW = days.map((x) => weekday(x.date, "short"));
    const DOWL = days.map((x) => weekday(x.date, "long"));
    const statusOf = (i: number): DesignStatus => (view ? designStatus(view.week[i].status, i, di) : "future");
    const tones = days.map((x, i) => toneOf(x, statusOf(i)));
    const ringTones = tones.join(",");
    const T: DesignDay = days[di] ?? { index: 0, date: "", t: "base", am: [], pm: [], swapped: false };
    const S = view?.sessions, amDone = !!S?.am?.done, pmDone = !!S?.pm?.done, isRest = !!view?.rest, restDone = !!view?.rest?.done;
    const todayComp = !!view?.dayComplete;
    const streak = view?.streak.continuity ?? 0;
    const atRisk = view?.streak.state === "at_risk";
    const busy = u.busy;
    // Better Auth names anonymous users "Anonymous"; that is not a display name the person chose.
    const myName = d.me && !(d.me.isAnonymous && d.me.displayName === "Anonymous") ? d.me.displayName || "" : "";
    const publicApp = (typeof window !== "undefined" ? window.location.origin : "") + "/app";
    const shortOf = (i: DesignItem) => i.short;
    const steps = (list: DesignItem[]) => list.map((p, i) => ({ n: i + 1, short: p.short, icon: p.icon, note: p.note }));

    // ---------- Today
    const amS = !!S?.am, pmS = !!S?.pm, amP = amS && !amDone, pmP = pmS && !pmDone;
    const curK = pmP && (isPM || !amP) ? "pm" : amP ? "am" : null;
    const curList = curK === "am" ? T.am : curK === "pm" ? T.pm : [];
    const otherLine = isRest ? (restDone ? "Rest day kept." : "Nothing scheduled today. That's the plan.")
      : curK === "pm" && amS ? (amDone ? "Morning done at " + hhmm(S?.am?.doneAt, tz) + "." : "Morning not marked yet.")
      : curK === "am" && pmS ? "Evening later: " + T.pm.length + " step" + (T.pm.length === 1 ? "" : "s") + "."
      : !curK ? "Morning and evening both done." : "";
    const dock: [string, string, (() => void) | null] = !view ? ["line", "", null]
      : isRest ? (restDone ? ["line", "Rest day done. See you tomorrow.", null] : ["btn", "Rest day done", () => complete("rest")])
      : todayComp ? ["line", "Today's done. See you tomorrow morning.", null]
      : isPM && pmS && !pmDone ? ["btn", "Mark evening done", () => complete("pm")]
      : amS && !amDone ? ["btn", "Mark morning done", () => complete("am")]
      : pmS && !pmDone ? ["line", "Morning done · Evening from 20:00", null] : ["line", "", null];
    const offer = view?.rescueOffer ?? null;
    const missedDate = offer?.skincareDate ?? null;
    const missedIdx = missedDate ? days.findIndex((x) => x.date === missedDate) : -1;
    const missedName = missedDate ? weekday(missedDate, "long") : "";
    const unresc = view?.unrescuable?.[0] ?? null;
    const banner = atRisk && missedDate
      ? { t: `${missedName} was missed. Rescue isn't switched on in this pilot yet, so your streak restarts once today is done.` }
      : unresc && !todayComp ? { t: `${weekday(unresc.skincareDate, "long")} was missed. Your streak restarts today. The rota carries on.` }
      : view?.lateNight && pmS && !pmDone ? { t: "Your evening still counts for " + (DOWL[di] || "today") + " until 4am." }
      : d.me?.isAnonymous !== false && streak >= 1 ? { t: "Your rota lives in this browser. Saving to an account isn't switched on in this pilot yet." }
      : null;

    // ---------- strip / week / day sheets
    const stripDays = days.map((x, i) => ({ d: DOW[i].slice(0, 2), long: DOWL[i], type: tagOf(x), steps: x.pm.filter((p) => p.analysed).map(shortOf).join(", ") || x.am.filter((p) => p.analysed).map(shortOf).join(", "), unknown: (x.pm.find((p) => !p.analysed) ?? x.am.find((p) => !p.analysed))?.name ?? "" }));
    const ws = u.weekOpen >= 0 ? u.weekOpen : Math.max(0, di);
    const wd = days[ws], wt = wd ? tagOf(wd) : "Rest";
    const wst = !wd ? "" : ws < di ? ({ done: "Done", rescued: "Rescued", missed: "Missed", today: "Missed", future: "Missed" } as Record<string, string>)[statusOf(ws)] : ws === di ? "Today" : "Ahead";
    let weekSelRows = wd ? [...wd.am.filter((p) => p.analysed).map((p) => ({ when: "Morning", t: p.short })), ...wd.pm.filter((p) => p.analysed).map((p) => ({ when: "Evening", t: p.short }))] : [];
    if (!weekSelRows.length) weekSelRows = [{ when: "All day", t: "Nothing scheduled. One check-in." }];
    const wu = wd ? [...wd.am, ...wd.pm].find((p) => !p.analysed) : undefined;
    const dx = days[u.sheetDay], dst = dx ? statusOf(u.sheetDay) : "future";
    const DS = ({ done: ["Done", "#9ED8CF", "#2A1911", "solid", "#1F7F7E"], rescued: ["Rescued", "#9ED8CF", "#2A1911", "solid", "#1F7F7E"], missed: ["Missed", "transparent", "#5A3824", "dashed", "#845535"], today: ["Today", "#FBFAF6", "#2A1911", "solid", "#EE6F3E"], future: ["Planned", "#FBFAF6", "#5A3824", "solid", "#C99A72"] } as Record<string, string[]>)[dst];
    const items = (l: DesignItem[]) => l.map((p, i) => ({ n: i + 1, t: p.short }));

    // ---------- Shelf + notes
    const held = new Map((rota?.held ?? []).map((h) => [h.productId, h.reason]));
    const notes: string[] = [...(rota?.shelfCheck ?? []).map((o) => o.text)];
    if (!rota) {
      const unk = shelf.filter((p) => !isAnalysable(p));
      if (unk.length) notes.push(`${unk[0].name} isn't analysed, so it's left out of every check and goes only where you put it.`);
      notes.push("Strong actives stay on your shelf, out of the rota, until a pharmacist-reviewed rule covers them.");
    }
    const notesRows = notes.slice(0, 3).map((t, i) => ({ n: "0" + (i + 1), t }));
    const shelfRows = shelf.map((p) => {
      const ses = sessionsFor(p.id, days), reason = held.get(p.id);
      const when = [ses.am && "AM", ses.pm && "PM"].filter(Boolean).join(" · ") || (reason ? HELD_REASON_TEXT[reason] : !rota ? (p.placement === "am" ? "Mornings · your choice" : p.placement === "pm" ? "Evenings · your choice" : isAnalysable(p) ? "Planned when you build" : "Not in rota") : "Added after this rota · from next week");
      return { name: p.name, role: shelfRole(p), when, dot: !isAnalysable(p) || reason ? "#845535" : "transparent", open: () => openSheet("product", { prodId: p.id }) };
    });
    const pp = shelfAll.find((p) => p.id === u.prodId) ?? null;
    const prov = pp ? provenanceOf(pp) : "unknown";
    const sel = (on: boolean) => ({ bg: on ? "#EE6F3E" : "#FBFAF6", bc: on ? "#2A1911" : "#C99A72" });
    const seg = (on: boolean) => ({ bg: on ? "#EE6F3E" : "transparent", sh: on ? "0 0 0 2px #2A1911" : "none" });

    // ---------- Add / unknown / paste / review
    const Q = u.query.trim().toLowerCase();
    const dupes = Q ? shelf.filter((p) => p.name.toLowerCase().includes(Q)) : [];
    const inMix = u.sheet === "mixPick";
    const catalogueEnabled = d.config?.capabilities?.catalogue === true;
    const photoEnabled = d.config?.capabilities?.photoReading === true;
    const barcodeEnabled = catalogueEnabled && d.config?.capabilities?.barcodeLookup === true;
    const catalogueMatches = catalogueEnabled && catalogue.query.trim().toLowerCase() === Q
      ? catalogue.results : [];
    const shelfMatches = inMix
      ? shelf.filter((p) => !Q || p.name.toLowerCase().includes(Q)).map((p) => ({
          name: p.name, meta: shelfRole(p), icon: CATEGORY_ICON[p.category], onShelf: false, canAdd: true,
          act: () => closeSheet(() => set((x) => ({ [x.mixSlot === "a" ? "mixA" : "mixB"]: { ref: { kind: "shelf", shelfProductId: p.id }, name: p.name, icon: CATEGORY_ICON[p.category] }, query: "" }) as Partial<UI>)),
        }))
      : dupes.map((p) => ({ name: p.name, meta: `${p.brand ? p.brand + " · " : ""}${shelfRole(p)}`, icon: CATEGORY_ICON[p.category], onShelf: true, canAdd: false, act: () => {} }));
    const catalogueRows = catalogueMatches.map((product) => ({
      name: product.name,
      meta: `${product.brand ? product.brand + " · " : ""}Product library · review before saving`,
      icon: CATEGORY_ICON[product.category] ?? "jar", onShelf: false, canAdd: true,
      act: () => {
        if (inMix) closeSheet(() => set((x) => ({ [x.mixSlot === "a" ? "mixA" : "mixB"]: { ref: { kind: "catalogue", catalogueId: product.catalogueId }, name: product.name, icon: CATEGORY_ICON[product.category] ?? "jar" }, query: "" }) as Partial<UI>));
        else openSheet("unknown", { unkName: product.name, unkPlace: "pm", unkFromReview: false, selectedCatalogue: product, revCat: product.category, revUse: product.format === "unknown" ? null : product.format });
      },
    }));
    const results = [...shelfMatches, ...catalogueRows];
    const n = shelf.length, src = u.source;
    const buildLabel = rota ? "Back to my shelf" : n >= 3 || src === "invite" || src === "mix" ? "Build my rota" : n === 0 ? "Add a product to start" : `Build with ${n} product${n > 1 ? "s" : ""}`;
    const cand = u.candidate;
    const candIngredients = (cand?.ingredients ?? []).filter((i) => u.corrections[i.id] !== null).map((i) => (u.corrections[i.id] != null ? { ...i, text: u.corrections[i.id] as string, status: "corrected" as const, activeClass: null } : i));
    const corrected = Object.keys(u.corrections).length > 0;
    const BD = (on: string, t: string) => on === "good" ? { t, bg: "#E3F1EC", ink: "#17605F", bs: "solid", bc: "#1F7F7E" } : on === "mid" ? { t, bg: "#FBFAF6", ink: "#2A1911", bs: "solid", bc: "#2A1911" } : { t, bg: "#FBFAF6", ink: "#5A3824", bs: "dashed", bc: "#845535" };
    const rvBadges = [BD(u.revName.trim() ? "mid" : "low", u.revName.trim() ? "Name · you typed it" : "Name · not read"), BD(corrected ? "mid" : "low", corrected ? "Ingredients · you corrected, awaiting confirmation" : "Ingredients · partly read")];
    const chipIng = cand?.ingredients.find((i) => i.id === u.chipId);

    // ---------- Mix
    const mres = u.mixResult;
    const vLabel = mres ? VERDICT_LABEL[mres.result.verdict] : "";
    const vt = VT[vLabel] ?? ["#F1E0D2", "#2A1911", vLabel];
    const mixObs = mres ? (mres.result.reasons.length ? mres.result.reasons.map((r) => ({ h: r.heading, t: r.body })) : [{ h: "We haven't reviewed this pair", t: "Until a pharmacist has, we won't call it compatible." }]) : [];
    if (mres && mres.result.unknownSubjectIds.length) mixObs.unshift({ h: "We can't confirm what's in one of these", t: "Products we haven't analysed are never called compatible. Paste the ingredient list to know more." });
    const mixSlot = (k: string, p: MixPick | null, slot: "a" | "b") => ({ k, label: p ? p.name : "Choose a product", icon: p ? p.icon : "add", bg: p ? "#FBFAF6" : "#F7EFE7", bs: p ? "solid" : "dashed", bc: p ? "#2A1911" : "#C99A72", pick: () => openSheet("mixPick", { mixSlot: slot, query: "" }) });
    const classes = (i: 0 | 1) => (mres?.result.activeClasses[i] ?? []).map((c) => ACTIVE_LABEL[c]).join(" + ") || "Product";
    const mixCarry = u.mixA && u.mixB ? `From Mix Check: ${u.mixA.name} and ${u.mixB.name}. ${vLabel ? vLabel + "." : ""}` : "";

    // ---------- Reveal / building
    const actN = days.filter((x) => x.t === "r" || x.t === "b").length, recN = days.filter((x) => x.t === "rec").length;
    const actNames = rota ? rota.held.filter((h) => h.reason === "insufficient_evidence").length : 0;

    // ---------- Share card
    const names = u.shareNames;
    const C: Record<string, any> = {
      rota: { bg: "#3E63D8", ink: "#FBFAF6", field: "rinse", grid: true, wash: "rgba(62,99,216,.55)", s1: "My week,", s2: "planned.", meta: names ? shelf.filter((p) => isAnalysable(p)).map((p) => p.name).join(" · ") || "myrota" : actN ? `${actN} strong nights · ${recN} recovery` : "7 days · from my own shelf" },
      mix: { bg: "#F1E0D2", ink: "#2A1911", field: "sunrise", panel: true, mixHead: "Mix Check · " + (names && u.mixA && u.mixB ? `${u.mixA.name} + ${u.mixB.name}` : `${classes(0)} + ${classes(1)}`), tag: vLabel, tagBg: (VS[vLabel] ?? [])[2] ?? "#F1E0D2", tagInk: (VS[vLabel] ?? [])[3] ?? "#2A1911", s1: (VS[vLabel] ?? [vLabel])[0], s2: (VS[vLabel] ?? ["", ""])[1], meta: publicApp.replace(/^https?:\/\//, "") + "/mix" },
      day3: { bg: "#E8CDB9", ink: "#2A1911", field: "skin", photo: true, slot: "share-day3", shot: "", rule: 3, pfield: "sunrise", ring: true, tones: "#E8CDB9,#C99A72,#845535,#E8D8C9,#E8D8C9,#E8D8C9,#E8D8C9", s1: "Three days", s2: "in a row.", meta: publicApp.replace(/^https?:\/\//, "") },
      day7: { bg: "#9ED8CF", ink: "#2A1911", field: "sea", window: true, tones: ringTones.replace(/x/g, "#E8D8C9"), s1: "Rota", s2: "complete.", meta: "7 of 7 · Week " + (rota?.weekNumber ?? 1) },
    };
    const card = C[u.shareType] ?? C.rota;
    const F = ({ story: ["260px", "9/16", "column", "28px", "auto"], square: ["100%", "1/1", "column", "28px", "auto"], link: ["100%", "1200/630", "row", "24px", "44%"] } as Record<string, string[]>)[u.shareFmt];
    const shareText = u.shareType === "mix"
      ? `Mix Check on myrota: ${names && u.mixA && u.mixB ? `${u.mixA.name} + ${u.mixB.name}` : `${classes(0)} + ${classes(1)}`} → ${vLabel}. Check your own pair: ${publicApp}/mix`
      : u.shareType === "day3" ? `Three days in a row on my skincare rota. Build yours from what you already own: ${publicApp}`
      : u.shareType === "day7" ? `Rota complete: seven days followed. Build yours from what you already own: ${publicApp}`
      : `I planned my skincare week with myrota${names && C.rota.meta ? ` (${C.rota.meta})` : ""}. Build yours from what you already own: ${publicApp}`;

    // ---------- Week end
    const wsum = view?.weekSummary;
    const okN = wsum ? wsum.followed : 0, earnedN = wsum?.earned ?? 0;
    const RF: Record<string, string> = { calm: "Next week keeps the same plan.", bit: "Next week keeps the same plan, no stronger.", very: "Next week keeps the same plan, no stronger. If irritation continues, pause your strongest product and ask a pharmacist." };

    // ---------- Profile / look
    const dl = u.draft || u.look || { skin: -1, hair: "lowcut", face: "smile", extra: "none", bg: "seaglass" };
    const tab = u.avTab || "skin";
    const lookBase = { ...dl, skin: dl.skin >= 0 ? dl.skin : 5 };
    const installed = typeof window !== "undefined" && isStandalone();

    const screenKey = u.screen;
    const darkStatus = ["building", "mix", "mixResult", "scan"].includes(screenKey) || (screenKey === "today" && isPM);
    const tabsOn = ["today", "shelf", "friends"].includes(screenKey) && !!rota;
    const phoneBg = screenKey === "scan" ? "#2A1911" : screenKey === "today" && isPM ? "#1E3A3C" : screenKey === "building" || screenKey === "mix" ? "#3E63D8" : screenKey === "loading" || screenKey === "error" ? "#F7EFE7" : "#FBFAF6";

    const V: any = {
      S: { [screenKey]: true }, SH: u.sheet ? { [u.sheet]: true } : {},
      phoneBg, statusInk: darkStatus ? "#FBFAF6" : "#2A1911", tabsOn,
      tx: u.phase === "out" ? `translateX(${-28 * u.dir}px)` : u.phase === "in0" ? `translateX(${28 * u.dir}px)` : "translateX(0)",
      op: u.phase === "idle" ? 1 : 0, tr: u.phase === "in0" ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1), opacity 200ms",
      tabs: ([["today", "Today", "rota"], ["shelf", "Shelf", "shelf"], ["friends", "Friends", "friends"]] as const).map(([id, label, icon]) => ({ label, icon, mode: "mono", ink: screenKey === id ? "#2A1911" : "#5A3824", pill: screenKey === id ? "#EE6F3E" : "transparent", go: () => { if (screenKey !== id) go(id as Screen, 1); } })),
      toastOn: !!u.toast, toast: u.toast ?? "",
      sheetOn: !!u.sheet, scrimOp: u.sheetIn ? 1 : 0, sheetT: u.sheetIn ? "translateY(0)" : "translateY(100%)", closeSheet: () => closeSheet(),
      sheetLabel: ({ unknown: "Add a product we don't know", invite: "Share myrota", install: "Add to Home Screen", profile: "Your profile", avatar: "Pick a look", share: "Share", name: "Your name", notes: "About your shelf", week: "This week", day: "Day details", product: "Product", paste: "Paste ingredients", chip: "Correct an ingredient", mixPick: "Pick a product" } as Record<string, string>)[u.sheet ?? ""] ?? "Details",
      boot: d.boot, bootError: d.bootError, retryBoot: () => boot(),

      // welcome / navigation
      toAdd: () => go("add", 1, { source: "organic" }), back, toMix: () => go("mix", 1, { source: "mix", mixResult: null }),

      // add
      query: u.query, onQuery: (e: any) => set({ query: e.target.value }),
      resultsTyped: Q ? results.slice(0, 7) : [], results,
      catalogueEnabled, photoEnabled, barcodeEnabled, barcodeOpen: u.barcodeOpen && barcodeEnabled,
      openBarcode: () => set({ barcodeOpen: true }),
      closeBarcode: () => set({ barcodeOpen: false }),
      onBarcodeFound: (code: string) => {
        set({ barcodeOpen: false, query: code });
        toast("Barcode read. Looking for an exact product match.");
      },
      barcodeNoMatch: barcodeEnabled && /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(Q)
        && !catalogue.busy && catalogue.query.trim().toLowerCase() === Q
        && catalogueRows.length === 0,
      photoProcessing: busy === "extract",
      catalogueBusy: catalogueEnabled && catalogue.busy && catalogue.query.trim().toLowerCase() === Q,
      catalogueError: catalogueEnabled && catalogue.query.trim().toLowerCase() === Q ? catalogue.error : null,
      showUnknownRow: Q.length > 2 && !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(Q) && !dupes.some((p) => p.name.toLowerCase() === Q) && !catalogueRows.some((p) => p.name.toLowerCase() === Q),
      unknownRowSub: "Add it by name. We won't guess what's in it until its ingredients are read.",
      openUnknown: () => openSheet("unknown", { unkName: u.query.trim(), unkPlace: "pm", unkFromReview: false, selectedCatalogue: null, revCat: "other", revUse: null }),
      hasAdded: n > 0, added: shelf.map((p) => ({ short: p.name, icon: CATEGORY_ICON[p.category], remove: async () => { try { await repo.removeProduct(p.id); await loadShelf(); toast("Removed"); } catch (e) { fail(e); } } })),
      addMix: src === "mix" && !!mixCarry, mixCarry,
      buildLabel: busy === "add" ? "Saving…" : buildLabel,
      build: () => {
        if (rota) { go("shelf", -1); toast("Added. This week's rota stays as it is."); return; }
        if (!n) return;
        if (contextNeeds(shelf).care) go("context"); else go("building");
      },
      scanGo: () => go("scan", 1, {}), galleryGo: () => go("scan", 1, {}),
      scanBg: n ? "#FBFAF6" : "#EE6F3E", scanInk: n ? "#A9401A" : "#2A1911", scanSh: n ? "none" : "3px 4px 0 #2A1911",

      // unknown sheet
      unkName: `“${u.unkName}”`, unkOpts: ([["am", "Morning"], ["pm", "Evening"], ["none", "Not yet"]] as const).map(([val, t]) => ({ t, bg: u.unkPlace === val ? "#F1E0D2" : "#FBFAF6", bc: u.unkPlace === val ? "#2A1911" : "#E8D8C9", pick: () => set({ unkPlace: val }) })),
      unkConfirmType: true,
      unkCats: [...CATS, ["other", "Not sure"] as [ProductCategory, string]].map(([val, t]) => ({ t, val, picked: u.revCat === val, pick: () => set({ revCat: val }) })),
      unkFormats: ([["rinse_off", "Rinse-off"], ["leave_on", "Leave-on"], ["unknown", "Not sure"]] as const).map(([val, t]) => ({ t, picked: (u.revUse ?? "unknown") === val, pick: () => set({ revUse: val === "unknown" ? null : val }) })),
      unkTitle: u.unkFromReview ? "Where does it go?" : u.selectedCatalogue ? "Found in product library" : "Unknown product",
      unkBody: u.unkFromReview ? "We read its ingredient list, but until that list is confirmed we won't check it against your other products. It goes only where you put it."
        : u.selectedCatalogue ? "This is a library listing, not a safety review. We'll save the source and your placement without calling its ingredients clinically verified."
        : "We haven't identified this product's exact ingredients. It goes on your shelf where you put it, without unverified compatibility advice.",
      unkCta: busy === "add" ? "Saving…" : u.selectedCatalogue ? "Add this product to shelf" : u.unkFromReview ? "Add to shelf" : "Add to shelf as unknown",
      addUnknown: async () => {
        if (busy) return;
        const name = u.unkName.trim().slice(0, 180);
        if (!name) { toast("Give it a name first"); return; }
        let ok: boolean;
        if (u.unkFromReview && cand) {
          ok = await addDraft({ brand: cand.brand ?? "", name, category: u.revCat ?? "other", format: u.revUse ?? "unknown", identityStatus: "user_confirmed", inciStatus: corrected ? "corrected" : cand.inciStatus, identityKey: null, variant: cand.variant, ingredients: candIngredients, placement: u.unkPlace, source: u.candidateMethod, extractionId: cand.extractionId }, "Added to your shelf");
        } else if (u.selectedCatalogue) {
          const product = u.selectedCatalogue;
          if (shelf.some((p) => p.name.toLowerCase() === product.name.toLowerCase() && p.brand.toLowerCase() === product.brand.toLowerCase())) {
            toast("Already on your shelf"); return;
          }
          // A crowdsourced/library source does not confer clinical verification.
          // Keep the source identifier for server-side validation.
          const draft = draftFromCatalogue(product);
          ok = await addDraft({
            ...draft,
            category: u.revCat ?? "other",
            format: u.revUse ?? "unknown",
            placement: u.unkPlace,
            identityStatus: "user_confirmed",
            identityKey: null,
            inciStatus: product.ingredients.length ? "partial" : "unknown",
            ingredients: product.ingredients.map((ing) => ({ ...ing, status: "read", activeClass: null, flagged: false })),
          }, "Added from product library");
        } else ok = await addDraft(draftForUnknown(name, u.unkPlace, u.revCat ?? "other", u.revUse ?? "unknown"), "Added as unknown");
        if (ok) closeSheet(() => { set({ query: "", candidate: null, selectedCatalogue: null, corrections: {}, revName: "" }); if (u.unkFromReview) go(u.source === "shelf" ? "shelf" : "add", -1); });
      },

      // paste + scan
      pasteText: u.pasteText, onPaste: (e: any) => set({ pasteText: e.target.value }),
      // The add screen's "Paste ingredients" and the paste sheet's "Read ingredients" share this binding in the source.
      pasteGo: async () => {
        if (u.sheet !== "paste") { openSheet("paste"); return; }
        if (busy) return;
        const text = u.pasteText.trim();
        if (!text) { toast("Paste the ingredient list first"); return; }
        set({ busy: "extract" });
        try {
          const res = await repo.extract({ method: "paste", side: "back", pastedText: text });
          if (!res.ok) { toast(PROBLEM_TEXT[res.problem]); return; }
          closeSheet(() => go("review", 1, { candidate: res.candidate, revStep: 1, revName: res.candidate.name ?? "", revCat: res.candidate.category, revUse: res.candidate.format && res.candidate.format !== "unknown" ? res.candidate.format : null, corrections: {}, candidateMethod: "paste", pasteText: "" }));
        } catch (e) { fail(e); } finally { set({ busy: null }); }
      },
      onPhoto: async (event: any) => {
        const input = event.currentTarget as HTMLInputElement;
        const image = input.files?.[0];
        const method: "scan" | "gallery" = input.dataset.method === "scan" ? "scan" : "gallery";
        input.value = "";
        if (!image || busy) return;
        if (!photoEnabled) { toast("Photo reading is not available yet. Paste the ingredients instead."); return; }
        if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) { toast("Use a JPG, PNG or WebP photo of the label."); return; }
        if (image.size === 0) { toast("That photo looks empty. Try taking it again."); return; }
        if (image.size > 20 * 1024 * 1024) { toast("That photo is very large. Try a normal camera photo."); return; }
        set({ busy: "extract" });
        try {
          // Compress large phone photos to fit the server's 6 MB limit, keeping text legible.
          const prepared = await fitImageForUpload(image);
          const res = await repo.extract({ method, side: "back" }, prepared);
          if (!res.ok) { toast(PROBLEM_TEXT[res.problem]); return; }
          go("review", 1, {
            candidate: res.candidate, revStep: 1, revName: res.candidate.name ?? "",
            revCat: res.candidate.category,
            revUse: res.candidate.format && res.candidate.format !== "unknown" ? res.candidate.format : null,
            corrections: {}, selectedCatalogue: null, candidateMethod: method,
          });
        } catch (e) { fail(e); } finally { set({ busy: null }); }
      },
      scan: { perm: true, view: false, glare: false, proc: false }, scanKicker: "Scan", procN: 0,
      scanTitle: photoEnabled ? "Photograph the ingredient list" : "Label photos are coming soon",
      scanBody: photoEnabled
        ? "Keep the back label in focus and avoid glare. You'll review the extracted text before anything is saved."
        : "Photo reading isn't enabled yet. Paste the ingredient list or add the product by name.",
      scanPrimary: photoEnabled ? "Take label photo" : "Paste ingredients",
      scanSecondary: photoEnabled ? "Choose from gallery" : "Add it by name",
      camAllow: photoEnabled ? () => document.getElementById("myrota-scan-camera")?.click() : () => openSheet("paste"),
      toGallery: photoEnabled ? () => document.getElementById("myrota-scan-gallery")?.click() : () => go("add", -1),
      shutter: () => {}, openPaste: () => openSheet("paste"),

      // review (pasted INCI)
      revStepLabel: u.revStep === 1 ? "Step 1 of 2" : "Step 2 of 2", rs1: u.revStep === 1, rs2: u.revStep === 2, rsFlag: false,
      rv: { icon: CATEGORY_ICON[u.revCat ?? "other"], name: u.revName || "Name not read yet", brand: cand?.brand || "Brand not read", askFront: true, flags: [], chips: [] },
      rvTitle: u.revName.trim() || "Name not read yet", rvProv: rvBadges.map((b) => b.t).join(" · "),
      revName: u.revName, onRevName: (e: any) => set({ revName: e.target.value.slice(0, 180) }),

      rvCats6: CATS.map(([val, t]) => { const s0 = sel(u.revCat === val); return { t, ...s0, bd: s0.bc === "#2A1911" ? "2px solid #2A1911" : "1.5px solid #C99A72", pick: () => set({ revCat: val }) }; }),
      rvUse2: ([["rinse_off", "Rinse-off"], ["leave_on", "Leave-on"]] as const).map(([val, t]) => ({ t, ...seg(u.revUse === val), pick: () => set({ revUse: val }) })),
      revNext: () => { if (!u.revName.trim()) { toast("Type the product name first"); return; } if (!u.revCat) { toast("Pick what type of product it is"); return; } set({ revStep: 2 }); },
      retake: () => { if (u.candidateMethod === "paste") openSheet("paste"); else go("add", -1); },
      actRows: candIngredients.slice(0, 6).map((i) => ({ t: i.text + (i.status === "corrected" ? " · edited" : ""), kind: "read", edit: () => openSheet("chip", { chipId: i.id, chipDraft: i.text }) })),
      unreadOn: candIngredients.length > 6, unreadLine: `+ ${candIngredients.length - 6} more ingredient${candIngredients.length - 6 === 1 ? "" : "s"} read`, unreadFix: () => openSheet("notes"),
      reviewCta: "Add to shelf",
      reviewAdd: () => openSheet("unknown", { unkName: u.revName.trim(), unkPlace: u.revCat === "sunscreen" ? "am" : "pm", unkFromReview: true }),
      flagTag: "", flagTitle: "", flagBody: "", flagSrc: "", flagNext: () => set({ revStep: 2 }),
      chipTitle: chipIng ? `Correct “${chipIng.text}”` : "Correct an ingredient", chipDraft: u.chipDraft, onChipDraft: (e: any) => set({ chipDraft: e.target.value.slice(0, 200) }),
      chipSave: () => { const id = u.chipId; if (!id) return; const t = u.chipDraft.trim(); closeSheet(() => set((x) => ({ corrections: t ? { ...x.corrections, [id]: t } : x.corrections }))); },
      chipRemove: () => { const id = u.chipId; if (!id) return; closeSheet(() => set((x) => ({ corrections: { ...x.corrections, [id]: null } }))); },

      // context (asked only when evidence-backed actives exist)
      ctxQs: (() => {
        const need = contextNeeds(shelf), qs: any[] = [];
        if (need.retinoid) qs.push({ q: "Have you used a retinoid before?", why: "It sets how often a reviewed plan would start it.", opts: ([["new", "No, new to it"], ["some", "Yes, for a few months"], ["long", "Yes, for over a year"]] as const).map(([val, t]) => ({ t, ...sel(u.ctxRet === val), pick: () => set({ ctxRet: val }) })) });
        qs.push({ q: "Anything we should plan around?", why: "Some treatments are best checked with a professional first.", opts: ([["preg", "Pregnant or breastfeeding"], ["rx", "Using a prescription skin treatment"], ["none", "None of these"], ["skip", "Prefer not to say"]] as const).map(([val, t]) => ({ t, ...sel(u.ctxCare === val), pick: () => set({ ctxCare: val }) })) });
        return qs;
      })(),
      ctxOp: u.ctxCare && (!contextNeeds(shelf).retinoid || u.ctxRet) ? 1 : 0.4, ctxPe: u.ctxCare && (!contextNeeds(shelf).retinoid || u.ctxRet) ? "auto" : "none",
      ctxGo: () => go("building"),

      // building
      buildN: u.buildN,
      buildLines: ([[`Reading ${n} product${n === 1 ? "" : "s"}`, 1], ["Setting your morning and evening order", 3], ["Keeping unconfirmed products where you put them", 5]] as const).map(([t, at]) => ({ t, op: u.buildN >= at ? 1 : 0.15 })),

      // reveal
      revealKicker: "Your first rota", revealDayName: DOWL[0] ?? "", revAmLine: (days[0]?.am ?? []).map((p) => p.short + (p.analysed ? "" : " (your choice, not analysed)")).join(", ") || "Nothing scheduled for mornings yet",
      insight: notes[0] ?? "Your week is planned from what you own. Nothing gets stronger automatically.", notesRows, moreNotesOn: notes.length > 1, moreNotes: `${notes.length - 1} more ${notes.length - 1 === 1 ? "note" : "notes"}`,
      moreNotesAny: notes.length > 0, shelfNotesLine: `${notes.length} ${notes.length === 1 ? "note" : "notes"} about your shelf`, openNotes: () => openSheet("notes"),
      stripDays, stripSel: u.stripSel >= 0 ? u.stripSel : 0, stripPick: (i: number) => set({ stripSel: i }),
      startRota: () => { go("today", 1); later(() => toast("Day 1. Your streak starts today."), 400); },
      shareRota: () => openSheet("share", { shareType: "rota", shareNames: false, shareFmt: "story" }),
      heldCount: actNames,

      // today
      dayLabelShort: di >= 0 ? (DOWL[di].slice(0, 3).toUpperCase() + " · DAY " + (di + 1)) : "",
      dayStatement: di >= 0 ? dayStatementOf(T) : "Week ended.", streak, streakLabel: atRisk ? "Streak at risk" : "day streak",
      fieldAm: isPM || amDone ? 0 : 1, fieldPm: isPM || amDone ? 1 : 0, fieldInk: isPM || amDone ? "#FBFAF6" : "#2A1911",
      todayBg: isPM ? "#EEF0EC" : "#F7EFE7",
      ringTones2: ringTones.replace(/x/g, TRACK), todayHollow: todayComp || di < 0 ? -1 : di,
      ringMissed: days.map((_, i) => (statusOf(i) === "missed" ? i : -1)).filter((i) => i >= 0).join(","),
      ringRescued: days.map((_, i) => (statusOf(i) === "rescued" ? i : -1)).filter((i) => i >= 0).join(","),
      meWho: myName, meLook: u.look, pairOn: false, pairWho: "", pairLook: null, pairTones: "",
      avatarAria: "Open your profile", openFriendsSheet: () => openSheet("profile"), openWeek: () => openSheet("week", { weekOpen: Math.max(0, di) }),
      bannerOn: !!banner, bannerText: banner?.t ?? "", bannerHasA: false, bannerA: "", bannerAct: () => {},
      curOn: !!curK, curTitle: curK === "pm" ? "Evening" : "Morning", curSteps: steps(curList).slice(0, 5), curSwap: false, openSwap: () => {},
      otherOn: !!otherLine, otherLine,
      dockBtn: dock[0] === "btn", dockLineOn: dock[0] === "line" && !!dock[1], dockLabel: busy === "complete" ? "Saving…" : dock[1], dockAct: busy ? () => {} : dock[2] ?? (() => {}),
      numFs200: String(streak).length >= 3 ? "64px" : "80px", numFs320: String(streak).length >= 3 ? "112px" : "144px", numFs120: String(streak).length >= 3 ? "36px" : "44px",
      popT: u.pop ? "scale(1.18)" : "scale(1)",
      // week sheet
      dayIdx: di, weekSel: ws, weekPick: (i: number) => set({ weekOpen: i }),
      weekSelHead: wd ? DOWL[ws] + " · " + wt + (wt === "Rest" ? " day" : wt === "Daily" ? "" : " night") : "", weekSelState: wst, weekSelRows, weekSelUnk: !!wu, weekSelUnkLine: wu ? "+ " + wu.name + " (not analysed)" : "",
      // day sheet
      ds: dx ? { title: DOWL[u.sheetDay], type: { r: "Retinoid night", b: "Exfoliant night", rec: "Recovery night", base: "Daily" }[dx.t], status: DS[0], stBg: DS[1], stInk: DS[2], stBs: DS[3], stBc: DS[4], rest: !dx.am.length && !dx.pm.length, sessions: [dx.am.length ? { t: "Morning", bg: "#F6B48F", ink: "#2A1911", items: items(dx.am) } : null, dx.pm.length ? { t: "Evening", bg: "#1E3A3C", ink: "#FBFAF6", items: items(dx.pm) } : null].filter(Boolean) } : { title: "", type: "", status: "", sessions: [] },

      // day done
      dayOf: `Day ${di + 1} of 7`, doneTitle: view?.streak.earned === 3 ? "Three days in a row." : `Day ${di + 1} done.`,
      ...(view?.streak.earned === 3 ? { doneCta: "Share your 3-day streak", doneAct: () => openSheet("share", { shareType: "day3", shareNames: false, shareFmt: "story" }), showDoneBack: true } : { doneCta: "Back to today", doneAct: () => go("today", -1), showDoneBack: false }),
      doneContinue: () => go("today", -1),

      // shelf
      shelfRows, shelfAdd: () => go("add", 1, { source: "shelf", query: "" }),
      pd: { name: pp?.name ?? "", icon: pp ? CATEGORY_ICON[pp.category] : "jar", prov: PROV_LABEL[prov][0], provInk: PROV_LABEL[prov][1], timing: !!pp && !isAnalysable(pp) },
      pdTiming: ([["am", "Morning"], ["pm", "Evening"], ["none", "Not in rota"]] as const).map(([val, t]) => ({ t, ...sel((pp?.placement ?? "none") === val), pick: async () => { if (!pp) return; try { await repo.patchProduct(pp.id, { placement: val }); await loadShelf(); toast(rota ? "Saved. This week's rota stays as it is." : "Saved"); } catch (e) { fail(e); } } })),
      pdActions: [
        { t: "Mark as finished", ink: "#2A1911", act: () => closeSheet(async () => { if (!pp) return; try { await repo.patchProduct(pp.id, { finished: true }); await loadShelf(); toast(rota ? "Marked finished. This week's rota stays as it is." : "Marked finished"); } catch (e) { fail(e); } }) },
        { t: "Remove from shelf", ink: "#2A1911", act: () => closeSheet(async () => { if (!pp) return; try { await repo.removeProduct(pp.id); await loadShelf(); toast("Removed"); } catch (e) { fail(e); } }) },
      ],

      // friends (gated: no pairing backend)
      hasFriends: false, noFriends: true, friendRows: [],
      friendsEmptyLine: "Friend Streaks aren't switched on in this pilot yet. You can still send myrota to a friend so they can build their own rota.",
      inviteBtnLabel: "Share myrota", openInvite: () => openSheet("invite"),
      inviteTitle: "Share myrota", inviteBody: "They build their own rota from their own shelf. Friend Streaks aren't switched on yet, so you won't see each other's progress.",
      inviteLink: publicApp.replace(/^https?:\/\//, ""),
      sendWhatsApp: () => { window.open("https://wa.me/?text=" + encodeURIComponent(`I'm on day ${streak} of my skin rota. Build your own from what you already have. Takes a minute: ${publicApp}`), "_blank", "noopener"); closeSheet(); },
      copyLink: async () => { try { await navigator.clipboard.writeText(publicApp); toast("Link copied"); } catch { toast(publicApp); } closeSheet(); },

      // mix
      mixSlots: [mixSlot("First product", u.mixA, "a"), mixSlot("Second product", u.mixB, "b")],
      mixOp: u.mixA && u.mixB ? 1 : 0.4, mixPe: u.mixA && u.mixB ? "auto" : "none",
      runMix: async () => {
        if (!u.mixA || !u.mixB || busy) return;
        set({ busy: "mix" });
        try { const r = await repo.mix({ a: u.mixA.ref, b: u.mixB.ref }); track("mix_checked", { verdict: r.result.verdict }); go("mixResult", 1, { mixResult: r, whyOpen: false }); }
        catch (e) { fail(e); } finally { set({ busy: null }); }
      },
      mixPickTitle: `Pick the ${u.mixSlot === "a" ? "first" : "second"} product`,
      pickUnknownMix: () => { const name = u.query.trim().slice(0, 120); if (!name) return; closeSheet(() => set((x) => ({ [x.mixSlot === "a" ? "mixA" : "mixB"]: { ref: { kind: "unknown", name }, name, icon: "jar" }, query: "" }) as Partial<UI>)); },
      mixScan: () => toast("Photo reading isn't switched on yet. Type the product name instead."),
      mixTitle: u.mixA && u.mixB ? `${u.mixA.name} + ${u.mixB.name}` : "",
      verdict: { v: vLabel, line: mres ? ({ insufficient_evidence: "We can't confirm this pair, so we won't call it compatible." } as Record<string, string>)[mres.result.verdict] ?? "" : "", bg: "#3E63D8" },
      vTagBg: vt[0], vTagInk: vt[1], vStatement: vt[2],
      whyOpen: u.whyOpen, whySign: u.whyOpen ? "−" : "+", toggleWhy: () => set((x) => ({ whyOpen: !x.whyOpen })), mixObs3: mixObs.slice(0, 3).map((o, i) => ({ ...o, n: i + 1 })),
      mixToRota: () => go(rota ? "shelf" : "add", 1, { source: "mix", query: "" }),
      shareMix: () => openSheet("share", { shareType: "mix", shareNames: false, shareFmt: "story" }),

      // share sheet
      shareTitle: ({ rota: "Share my rota", mix: "Share this answer", day3: "Share Day 3", day7: "Share my week" } as Record<string, string>)[u.shareType],
      card: { ...card, fs: F[3] }, cardWash: card.wash || "transparent", cardWords: false, cardStripScale: u.shareFmt === "link" ? 0.5 : u.shareFmt === "story" ? 0.68 : 0.82,
      cardFrameFlex: u.shareFmt === "link" ? "0 0 52%" : "0 0 auto", cardFrameMaxH: u.shareFmt === "link" ? "none" : "45%", cardFramePad: u.shareFmt === "link" ? "6px" : "10px", cardMax: F[0], cardAR: F[1], cardDir: F[2], cardTextW: F[4], winSize: u.shareFmt === "link" ? 140 : 200,
      fmtOpts: ([["story", "Story 9:16"], ["square", "Square"], ["link", "Link"]] as const).map(([val, t]) => ({ t, ...seg(u.shareFmt === val), pick: () => set({ shareFmt: val }) })),
      shareCanNames: u.shareType === "rota" || u.shareType === "mix", namesTrack: names ? "#EE6F3E" : "#F1E0D2", namesJust: names ? "flex-end" : "flex-start", toggleNames: () => set((x) => ({ shareNames: !x.shareNames })),
      shareOptsOpen: u.shareOpts, shareOptsLabel: u.shareOpts ? "Hide options" : "Options", toggleShareOpts: () => set((x) => ({ shareOpts: !x.shareOpts })),
      shareSend: () => { window.open("https://wa.me/?text=" + encodeURIComponent(shareText), "_blank", "noopener"); closeSheet(); },
      saveImageLabel: "Copy message", shareSave: async () => { try { await navigator.clipboard.writeText(shareText); toast("Message copied. Image cards aren't switched on yet."); } catch { toast("Couldn't copy. Use Share on WhatsApp."); } },

      // week end (reflection and week 2 gated)
      weekN: rota?.weekNumber ?? 1, nextWeekN: (rota?.weekNumber ?? 1) + 1, rcFull: earnedN === 7, rcCount: okN,
      rcTitle: earnedN === 7 ? "Rota complete." : "Week ended.", rcSub: earnedN === 7 ? "Seven days followed. Recovery and rest days counted like any other." : `${okN} of 7 days followed.`,
      reflectOpts: ([["calm", "Calm"], ["bit", "A bit irritated"], ["very", "Very irritated"]] as const).map(([val, t]) => ({ t, ...sel(u.reflect === val), pick: () => set({ reflect: val }) })),
      reflectNoteOn: !!u.reflect, reflectNote: u.reflect ? RF[u.reflect] + " Reflections aren't saved in this pilot yet." : "",
      planNextLabel: "Week 2 is coming soon", toNextWeek: () => toast("Week 2 isn't switched on in this pilot yet. Your history is kept."),
      shareDay7: () => openSheet("share", { shareType: "day7", shareNames: false, shareFmt: "story" }),
      nwRows: [], nwAdd: () => go("add", 1, { source: "shelf" }), startNextWeek: () => {},

      // name / profile / look
      nameTitle: "What should we call you?", nameHint: "Shown on your profile. You can change it any time.",
      nameDraft: u.nameDraft, onNameDraft: (e: any) => set({ nameDraft: e.target.value.slice(0, 60) }),
      nameOp: u.nameDraft.trim() ? 1 : 0.4, namePe: u.nameDraft.trim() ? "auto" : "none",
      saveName: async () => {
        const nm = u.nameDraft.trim();
        if (!nm || busy) return;
        set({ busy: "name" });
        try { const me = await repo.updateDisplayName(nm); setData((x) => ({ ...x, me })); closeSheet(); toast("Name saved"); }
        catch (e) { fail(e); } finally { set({ busy: null }); }
      },
      openLookFromName: () => closeSheet(() => openSheet("avatar", { draft: u.look, avTab: "skin" })),
      profName: myName || "Guest on this phone", profSub: "Saved in this browser · account saving isn't switched on yet",
      profRows: [
        { k: "Display name", v: myName || "Add", c: myName ? "#5A3824" : "#2A1911", act: () => set({ sheet: "name", nameDraft: myName, afterName: null }) },
        { k: "This rota", v: di >= 0 ? `Day ${di + 1} of 7` : rota ? "Week ended" : "Not started", c: "#5A3824", act: () => {} },
        { k: "Reminders", v: "Not in this pilot yet", c: "#5A3824", act: () => {} },
        { k: "Account", v: "Not available yet", c: "#5A3824", act: () => {} },
        { k: "App", v: installed ? "On home screen" : "Add to Home Screen", c: installed ? "#5A3824" : "#2A1911", act: () => { if (!installed) set({ sheet: "install" }); } },
      ],
      openBuilder: () => closeSheet(() => openSheet("avatar", { draft: u.look, avTab: "skin" })),
      draftLook: dl.skin >= 0 ? dl : null,
      avTabs: ([["skin", "Skin"], ["hair", "Hair"], ["face", "Face"], ["extra", "Extras"], ["bg", "Background"]] as const).map(([k, t]) => ({ t, bar: k === tab ? "#EE6F3E" : "transparent", ink: k === tab ? "#2A1911" : "#5A3824", go: () => set({ avTab: k }) })),
      avOpts: AV[tab].map((o) => { const on = (dl as any)[tab] === o, swatch = tab === "skin" || tab === "bg"; return { on, label: tab + " " + o, isSwatch: swatch, isAv: !swatch, sw: tab === "skin" ? SK[o as number] : BGC[o as string] || "", look: { ...lookBase, [tab]: o }, tileBg: "#F7EFE7", edge: on ? "inset 0 0 0 3px #EE6F3E" : "inset 0 0 0 1px #E8D8C9", pick: () => set((x) => ({ draft: { ...(x.draft || (dl as Look)), [tab]: o } as Look })) }; }),
      saveLook: () => { const dd = uiRef.current.draft; if (!dd || !(dd.skin >= 0)) { set({ avTab: "skin" }); toast("Pick a skin tone first"); return; } try { localStorage.setItem(LOOK_KEY, JSON.stringify(dd)); } catch { /* private mode: keep for this visit */ } set({ look: dd }); closeSheet(); toast("Look saved on this device"); },
      shuffleLook: () => { const r = (a: (string | number)[]) => a[Math.floor(Math.random() * a.length)]; set({ draft: { skin: r(AV.skin) as number, hair: r(AV.hair) as string, face: r(AV.face) as string, extra: r(AV.extra) as string, bg: r(AV.bg) as string } }); },
      usePhoto: () => toast("Photo avatars aren't available. Your look stays a drawing."),

      // install
      platOpts: ([["ios", "iPhone"], ["android", "Android"]] as const).map(([val, t]) => ({ t, ...seg(u.platform === val), pick: () => set({ platform: val }) })),
      isIOS: u.platform === "ios", isAndroid: u.platform === "android",
      iosSteps: [{ t: "Tap Share in Safari's toolbar.", share: true }, { t: "Choose Add to Home Screen." }, { t: "Open myrota from your Home Screen. If it asks you to start again, open it in Safari instead: your rota is saved in Safari." }].map((r, k) => ({ share: false, act: false, ...r, n: k + 1 })),
      iosSaveFirst: () => {}, doInstall: () => { closeSheet(); toast("Open myrota from your Home Screen"); },
      androidLine: "Open myrota in one tap from your home screen.",
      androidInstall: async () => { if (canPromptInstall()) { const r = await promptInstall(); closeSheet(); toast(r === "accepted" ? "myrota installed" : "No problem. You can install it later."); } else { closeSheet(); toast("Use your browser menu: Add to Home screen"); } },
      androidRemOnly: () => closeSheet(),
    };
    return V;
  }, [ui, data, view, catalogue, set, go, back, openSheet, closeSheet, later, toast, fail, repo, loadShelf, addDraft, complete, boot]);

  // Start the real build when the building screen appears.
  const building = ui.screen === "building";
  useEffect(() => { if (building) runBuild(); }, [building, runBuild]);
  // If the rota week has ended, Today becomes the week-end screen.
  useEffect(() => {
    if (ui.screen === "today" && view && view.dayIndex < 0 && view.weekSummary.closed) set({ screen: "rotaComplete" });
  }, [ui.screen, view, set]);

  return v;
}
