/**
 * DEMO_MODE repository — in memory only, for local development, previews and
 * screenshots. Never used unless NEXT_PUBLIC_MYROTA_DEMO=1 is set explicitly.
 *
 * Honesty rules: nothing here is persisted (no localStorage), invites/scan
 * results are simulated and labelled as such, and account claim always fails
 * with "not connected" rather than pretending to succeed.
 */
import { computeFriendStreak } from "../domain/friend-streak";
import { catalogueToMixSubject, evaluatePair, shelfToMixSubject, unknownMixSubject, type MixSubject } from "../domain/mix";
import { applyCompletion, applyRescue } from "../domain/records";
import { applyRecoverySwap, buildRota, mixNoteForRota } from "../domain/scheduler";
import { addDays, skincareDateAt, zonedWallTimeToInstant } from "../domain/skincare-day";
import { confirmIdentity, correctIngredient, removeIngredient } from "../domain/evidence";
import type { AcceptedStatuses, CatalogueProduct, DayRecord, PlanContext, RotaSnapshot, ShelfProduct } from "../domain/types";
import { nextRotaStart, recordReflection, recordsForRota, startNextWeek, type RotaHistory } from "../domain/week";
import type {
  ExtractionCandidate,
  ExtractResponse,
  FriendSummary,
  MixSubjectRef,
  ProductDraft,
  RemindersState,
} from "../api/contract";
import { ApiError, type RotaRepository } from "../api/repository";
import { DEMO_ALERT_FLAG, DEMO_CATALOGUE, DEMO_FRIEND, DEMO_INVITE_TOKEN, DEMO_JOINER, DEMO_LABEL_FLAG, DEMO_RULES } from "./fixtures";

export const DEMO_ACCEPTED: AcceptedStatuses = ["reviewed", "demo_fixture"];
export const DEMO_TZ = "Africa/Lagos";
const FRIEND_TZ = "Asia/Dubai";

export type DemoScenario =
  | "fresh"
  | "today-am"
  | "today-pm"
  | "late-night"
  | "missed"
  | "rescued"
  | "missed-last-week"
  | "second-miss"
  | "rest-day"
  | "week-complete"
  | "week-ended"
  | "friend-joined"
  | "flagged-shelf";

export const DEMO_SCENARIOS: { id: DemoScenario; label: string }[] = [
  { id: "fresh", label: "Fresh visitor · empty shelf" },
  { id: "today-am", label: "Today · morning, paired" },
  { id: "today-pm", label: "Today · evening atmosphere" },
  { id: "late-night", label: "Late night · before 04:00" },
  { id: "missed", label: "Yesterday missed · Rescue eligible" },
  { id: "rescued", label: "Rescued · continuity kept" },
  { id: "missed-last-week", label: "Day 7 missed · rescuable in week 2" },
  { id: "second-miss", label: "Second miss · Rescue used" },
  { id: "rest-day", label: "One-product invitee · Rest day" },
  { id: "week-complete", label: "Day 7 · 7/7 Rota complete" },
  { id: "week-ended", label: "Day 7 · Week ended 5/7" },
  { id: "friend-joined", label: "Inviter · Tobi joined" },
  { id: "flagged-shelf", label: "Shelf · safety flag + unknown" },
];

type ScanCase = "verified" | "flag" | "alert" | "partial";

interface DemoState {
  products: ShelfProduct[];
  history: RotaHistory;
  records: DayRecord[];
  friends: { summary: Omit<FriendSummary, "friendStreak" | "pairTodayCounted" | "today">; records: DayRecord[] }[];
  displayName: string | null;
  inviteCreated: boolean;
  reminders: RemindersState;
  scanCount: number;
  scanCase: ScanCase;
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function fromCatalogue(c: CatalogueProduct, now: string, over: Partial<ShelfProduct> = {}): ShelfProduct {
  return {
    id: `shelf-${c.catalogueId}`,
    brand: c.brand,
    name: c.name,
    category: c.category,
    format: c.format,
    identityStatus: "verified",
    inciStatus: c.inciStatus,
    identityKey: c.identityKey,
    variant: c.variant ?? null,
    ingredients: clone(c.ingredients),
    flags: [],
    source: "search",
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const catalogue = (id: string) => DEMO_CATALOGUE.find((c) => c.catalogueId === id)!;

function unknownProduct(name: string, now: string, over: Partial<ShelfProduct> = {}): ShelfProduct {
  return {
    id: `shelf-u-${uid().slice(0, 8)}`,
    brand: "",
    name,
    category: "other",
    format: "unknown",
    identityStatus: "unknown",
    inciStatus: "unknown",
    identityKey: null,
    ingredients: [],
    flags: [],
    placement: "pm",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function eventAt(date: string, session: "am" | "pm" | "rest", tz: string, rotaId: string) {
  const hour = session === "am" ? 8 : session === "pm" ? 21 : 10;
  return {
    id: uid(),
    rotaId,
    skincareDate: date,
    session,
    occurredAt: zonedWallTimeToInstant(date, hour, tz).toISOString(),
    timeZone: tz,
    idempotencyKey: uid(),
  };
}

function completeRecord(r: DayRecord, which: ("am" | "pm" | "rest")[] | "all"): DayRecord {
  const sessions = which === "all" ? (r.scheduled.am || r.scheduled.pm ? (["am", "pm"] as const).filter((k) => r.scheduled[k]) : (["rest"] as const)) : which;
  return { ...r, events: [...r.events, ...sessions.map((s) => eventAt(r.skincareDate, s, r.timeZone, r.rotaId))] };
}

interface SeedSpec {
  products: ShelfProduct[];
  dayIndex: number;
  hour: number;
  done: number[];
  todaySessions?: ("am" | "pm" | "rest")[];
  rescued?: number[];
  paired?: boolean;
  previousWeek?: { done: number[] };
  displayName?: string | null;
  context?: PlanContext;
}

function friendRecords(rota: RotaSnapshot, today: string, upTo: number, todayAmOnly: boolean): DayRecord[] {
  return rota.days.slice(0, upTo + 1).map((d) => {
    const date = d.skincareDate;
    const base: DayRecord = { rotaId: "friend-rota", skincareDate: date, timeZone: FRIEND_TZ, scheduled: { am: true, pm: true }, events: [] };
    if (date === today) return todayAmOnly ? completeRecord(base, ["am"]) : base;
    return completeRecord(base, "all");
  });
}

function seed(spec: SeedSpec, clockStart: { now: string }) {
  const today = skincareDateAt(clockStart.now, DEMO_TZ);
  const start = addDays(today, -spec.dayIndex);
  const created = zonedWallTimeToInstant(start, 7, DEMO_TZ).toISOString();
  const rotas: RotaSnapshot[] = [];
  let records: DayRecord[] = [];
  let previousRotaId: string | null = null;
  if (spec.previousWeek) {
    const prevStart = addDays(start, -7);
    const prev = buildRota({ rotaId: "demo-rota-w1", weekNumber: 1, startDate: prevStart, timeZone: DEMO_TZ, createdAt: created, products: spec.products, context: spec.context ?? {}, ruleSet: DEMO_RULES, accepted: DEMO_ACCEPTED });
    prev.archivedAt = zonedWallTimeToInstant(start, 6, DEMO_TZ).toISOString();
    rotas.push(prev);
    records = recordsForRota(prev, []).map((r, i) => (spec.previousWeek!.done.includes(i) ? completeRecord(r, "all") : r));
    previousRotaId = prev.id;
  }
  const rota = buildRota({
    rotaId: spec.previousWeek ? "demo-rota-w2" : "demo-rota-w1",
    weekNumber: spec.previousWeek ? 2 : 1,
    startDate: start,
    timeZone: DEMO_TZ,
    createdAt: created,
    products: spec.products,
    context: spec.context ?? {},
    ruleSet: DEMO_RULES,
    accepted: DEMO_ACCEPTED,
    previousRotaId,
  });
  rotas.push(rota);
  const week = recordsForRota(rota, []).map((r, i) => {
    if (i < spec.dayIndex && spec.done.includes(i)) return completeRecord(r, "all");
    if (i < spec.dayIndex && spec.rescued?.includes(i)) return { ...r, rescue: { rescuedAt: clockStart.now, idempotencyKey: uid() } };
    if (i === spec.dayIndex && spec.todaySessions?.length) return completeRecord(r, spec.todaySessions);
    return r;
  });
  if (spec.rescued?.length) rota.rescueUsedFor = rota.days[spec.rescued[0]].skincareDate;
  records = [...records, ...week];
  return { rotas, records, rota, today };
}

function scenarioState(id: DemoScenario, now: string): DemoState {
  const p = (ids: string[]) => ids.map((i) => fromCatalogue(catalogue(i), now));
  const set6 = () => [...p(["cleanser", "vitc", "ret", "bha", "moist", "spf"])];
  const base: DemoState = {
    products: [],
    history: { rotas: [], currentRotaId: null, appliedKeys: [] },
    records: [],
    friends: [],
    displayName: null,
    inviteCreated: false,
    reminders: { am: "07:30", pm: "21:00", enabled: false, timeZone: DEMO_TZ, pushSubscribed: false },
    scanCount: 0,
    scanCase: "partial",
  };
  if (id === "fresh") return base;

  const specs: Record<Exclude<DemoScenario, "fresh">, SeedSpec> = {
    "today-am": { products: set6(), dayIndex: 2, hour: 7, done: [0, 1], paired: true, displayName: "Kemi" },
    "today-pm": { products: set6(), dayIndex: 2, hour: 20, done: [0, 1], todaySessions: ["am"], paired: true, displayName: "Kemi" },
    "late-night": { products: set6(), dayIndex: 2, hour: 0.67, done: [0, 1], todaySessions: ["am"], paired: true, displayName: "Kemi" },
    missed: { products: set6(), dayIndex: 3, hour: 8, done: [0, 1], paired: true, displayName: "Kemi" },
    rescued: { products: set6(), dayIndex: 3, hour: 8, done: [0, 1], rescued: [2], paired: true, displayName: "Kemi" },
    "missed-last-week": { products: set6(), dayIndex: 0, hour: 8, done: [], previousWeek: { done: [0, 1, 2, 3, 4, 5] }, paired: true, displayName: "Kemi" },
    "second-miss": { products: set6(), dayIndex: 5, hour: 8, done: [0, 1, 3], rescued: [2], paired: true, displayName: "Kemi" },
    "rest-day": { products: p(["ret"]), dayIndex: 1, hour: 9, done: [0], paired: true },
    "week-complete": { products: set6(), dayIndex: 6, hour: 21, done: [0, 1, 2, 3, 4, 5], todaySessions: ["am", "pm"], displayName: "Kemi" },
    "week-ended": { products: set6(), dayIndex: 6, hour: 21, done: [0, 1, 3, 5], todaySessions: ["am", "pm"], displayName: "Kemi" },
    "friend-joined": { products: set6(), dayIndex: 4, hour: 18, done: [0, 1, 2, 3], displayName: "Kemi" },
    "flagged-shelf": {
      products: [
        ...set6(),
        unknownProduct("Shea butter from Makola", now),
        { ...unknownProduct("Clear Tone Cream", now), flags: [DEMO_LABEL_FLAG], inciStatus: "partial", ingredients: [
          { id: "hq-1", text: "Aqua", status: "read" },
          { id: "hq-2", text: "Hydroquinone 2%", status: "read", flagged: true },
          { id: "hq-3", text: "", status: "unreadable" },
        ], placement: "none" },
      ],
      dayIndex: 1, hour: 10, done: [0], displayName: "Kemi",
    },
  };
  const spec = specs[id];
  const s = seed(spec, { now });
  const state: DemoState = {
    ...base,
    products: spec.products,
    history: { rotas: s.rotas, currentRotaId: s.rota.id, appliedKeys: [] },
    records: s.records,
    displayName: spec.displayName ?? null,
    inviteCreated: !!spec.paired || id === "friend-joined",
    reminders: { ...base.reminders, enabled: id !== "rest-day" },
  };
  if (spec.paired) {
    state.friends.push({
      summary: { pairId: "pair-ama", displayName: DEMO_FRIEND.name, initials: DEMO_FRIEND.initials, joinedAt: now, newlyJoined: false },
      records: friendRecords(s.rota, s.today, spec.dayIndex, true),
    });
  }
  if (id === "friend-joined") {
    state.friends.push({
      summary: { pairId: "pair-tobi", displayName: DEMO_JOINER.name, initials: DEMO_JOINER.initials, joinedAt: now, newlyJoined: true },
      records: [],
    });
  }
  return state;
}

const SCENARIO_HOUR: Partial<Record<DemoScenario, number>> = {
  "today-am": 7, "today-pm": 20, "late-night": 0.67, missed: 8, rescued: 8, "missed-last-week": 8, "second-miss": 8,
  "rest-day": 9, "week-complete": 21, "week-ended": 21, "friend-joined": 18, "flagged-shelf": 10, fresh: 9,
};

/** Demo clock: the real date in Lagos, at the scenario's local hour, then running in real time. */
function scenarioNow(id: DemoScenario) {
  const realToday = skincareDateAt(new Date(), DEMO_TZ);
  const hour = SCENARIO_HOUR[id] ?? 9;
  // Late night belongs to the previous skincare date's evening.
  const date = hour < 4 ? addDays(realToday, 1) : realToday;
  const base = zonedWallTimeToInstant(date, Math.floor(hour), DEMO_TZ).getTime() + Math.round((hour % 1) * 60) * 60_000;
  return base;
}

export function createDemoRepository(scenario: DemoScenario = "fresh"): RotaRepository & { scenario: DemoScenario; setScanCase(c: ScanCase): void } {
  const t0 = Date.now();
  const base = scenarioNow(scenario);
  const now = () => new Date(base + (Date.now() - t0)).toISOString();
  const state = scenarioState(scenario, now());

  const current = () => state.history.rotas.find((r) => r.id === state.history.currentRotaId) ?? null;
  const replaceRota = (rota: RotaSnapshot) => {
    state.history = { ...state.history, rotas: state.history.rotas.map((r) => (r.id === rota.id ? rota : r)) };
  };
  const recordFor = (rotaId: string, date: string) => {
    const rota = state.history.rotas.find((r) => r.id === rotaId);
    if (!rota) throw new ApiError("not_found", "Unknown rota", 404);
    const existing = state.records.find((r) => r.rotaId === rotaId && r.skincareDate === date);
    if (existing) return existing;
    const made = recordsForRota(rota, []).find((r) => r.skincareDate === date);
    if (!made) throw new ApiError("validation", "That date isn't in this rota", 422);
    state.records.push(made);
    return made;
  };
  const putRecord = (rec: DayRecord) => {
    state.records = [...state.records.filter((r) => !(r.rotaId === rec.rotaId && r.skincareDate === rec.skincareDate)), rec];
  };
  const subjectFor = (ref: MixSubjectRef): MixSubject => {
    if (ref.kind === "shelf") {
      const p = state.products.find((x) => x.id === ref.shelfProductId);
      if (!p) throw new ApiError("not_found", "Not on your shelf", 404);
      return shelfToMixSubject(p, DEMO_ACCEPTED);
    }
    if (ref.kind === "catalogue") return catalogueToMixSubject(catalogue(ref.catalogueId));
    return unknownMixSubject(`unknown:${ref.name}`, ref.name);
  };
  const ensureProductFor = (ref: MixSubjectRef) => {
    if (ref.kind === "shelf") return state.products.find((p) => p.id === ref.shelfProductId) ?? null;
    if (ref.kind === "catalogue") return state.products.find((p) => p.identityKey === catalogue(ref.catalogueId).identityKey) ?? null;
    return state.products.find((p) => p.name === ref.name) ?? null;
  };
  const friendsView = (): FriendSummary[] => {
    const rota = current();
    const mine = state.records.filter((r) => !rota || r.rotaId === rota.id || state.history.rotas.some((x) => x.id === r.rotaId));
    return state.friends.map((f) => {
      const fs = computeFriendStreak({ timeZone: DEMO_TZ, records: mine }, { timeZone: FRIEND_TZ, records: f.records }, now());
      return { ...f.summary, today: fs.friend, friendStreak: fs.streak, pairTodayCounted: fs.pairTodayCounted };
    });
  };

  const repo: RotaRepository & { scenario: DemoScenario; setScanCase(c: ScanCase): void } = {
    mode: "demo",
    scenario,
    setScanCase(c) {
      state.scanCase = c;
      state.scanCount = 1;
    },
    async config() {
      return { providers: { google: true, emailOtp: true, apple: false }, turnstileSiteKey: null, vapidPublicKey: null };
    },
    async me() {
      await wait(40);
      if (!state.products.length && !current()) return null;
      return { userId: "demo-guest", isAnonymous: true, displayName: state.displayName, identityProviders: [], hasRota: !!current() };
    },
    async updateDisplayName(displayName) {
      await wait();
      state.displayName = displayName.trim();
      return { userId: "demo-guest", isAnonymous: true, displayName: state.displayName, identityProviders: [], hasRota: !!current() };
    },
    async shelf() {
      await wait();
      return { products: clone(state.products) };
    },
    async addProduct(draft: ProductDraft) {
      await wait();
      const dup = draft.identityKey ? state.products.find((p) => p.identityKey === draft.identityKey) : null;
      if (dup) return { product: clone(dup), duplicate: true };
      const t = now();
      const product: ShelfProduct = {
        id: `shelf-${uid().slice(0, 8)}`,
        brand: draft.brand,
        name: draft.name,
        category: draft.category,
        format: draft.format,
        identityStatus: draft.identityStatus,
        inciStatus: draft.inciStatus,
        identityKey: draft.identityKey ?? null,
        variant: draft.variant ?? null,
        ingredients: clone(draft.ingredients),
        flags: draft.extractionId === "demo-flag" ? [DEMO_LABEL_FLAG] : draft.extractionId === "demo-alert" ? [DEMO_ALERT_FLAG] : [],
        placement: draft.placement ?? (draft.inciStatus === "verified" || draft.inciStatus === "user_confirmed" ? undefined : "none"),
        source: draft.source,
        createdAt: t,
        updatedAt: t,
      };
      state.products.push(product);
      return { product: clone(product), duplicate: false };
    },
    async patchProduct(id, patch) {
      await wait();
      const i = state.products.findIndex((p) => p.id === id);
      if (i < 0) throw new ApiError("not_found", "Not on your shelf", 404);
      let p = state.products[i];
      if (patch.name !== undefined || patch.brand !== undefined) p = confirmIdentity(p, patch.name ?? p.name, patch.brand);
      for (const c of patch.ingredientCorrections ?? []) p = c.text === null ? removeIngredient(p, c.ingredientId) : correctIngredient(p, c.ingredientId, c.text);
      if (patch.category) p = { ...p, category: patch.category };
      if (patch.format) p = { ...p, format: patch.format };
      if (patch.placement) p = { ...p, placement: patch.placement };
      if (patch.finished !== undefined) p = { ...p, finishedAt: patch.finished ? now() : null };
      p = { ...p, updatedAt: now() };
      state.products[i] = p;
      return clone(p);
    },
    async removeProduct(id) {
      await wait();
      state.products = state.products.filter((p) => p.id !== id);
    },
    async searchCatalogue(q) {
      await wait(80);
      const query = q.trim().toLowerCase();
      return { results: clone(DEMO_CATALOGUE.filter((c) => !query || `${c.brand} ${c.name} ${c.category}`.toLowerCase().includes(query))) };
    },
    async extract(req): Promise<ExtractResponse> {
      await wait(900);
      state.scanCount += 1;
      if (req.method === "scan" && req.side === "back" && state.scanCount === 1) return { ok: false, problem: "glare" };
      const c: ScanCase = req.method === "paste" ? "partial" : req.side === "front" ? "partial" : state.scanCase;
      const unread = (k: string) => ({ id: `${k}-${uid().slice(0, 4)}`, text: "", status: "unreadable" as const });
      const read = (text: string, activeClass: ExtractionCandidate["ingredients"][number]["activeClass"] = null, flagged = false) => ({ id: uid().slice(0, 8), text, status: "read" as const, activeClass, flagged });
      const cand: Record<ScanCase, ExtractionCandidate> = {
        verified: { extractionId: "demo-verified", brand: "Demo Lab", name: "Retinal Night Serum", category: "treatment", identityStatus: "verified", inciStatus: "verified", identityKey: "demo:ret", variant: "standard", ingredients: clone(catalogue("ret").ingredients), flags: [], provider: "demo-simulated" },
        flag: { extractionId: "demo-flag", brand: null, name: "Clear Tone Cream", category: "moisturiser", identityStatus: "partial", inciStatus: "partial", identityKey: null, variant: null, ingredients: [read("Aqua"), read("Hydroquinone 2%", null, true), read("Glycerin"), read("Cetearyl Alcohol"), unread("x")], flags: [DEMO_LABEL_FLAG], provider: "demo-simulated" },
        alert: { extractionId: "demo-alert", brand: null, name: "Bright Glow Lotion", category: "moisturiser", identityStatus: "partial", inciStatus: "partial", identityKey: null, variant: null, ingredients: [read("Aqua"), read("Glycerin"), read("Parfum"), unread("x"), unread("y")], flags: [], provider: "demo-simulated" },
        partial: { extractionId: "demo-partial", brand: null, name: req.side === "front" ? "Daily Glow Serum" : null, category: "serum", identityStatus: req.side === "front" ? "partial" : "unknown", inciStatus: "partial", identityKey: null, variant: null, ingredients: req.method === "paste" && req.pastedText ? req.pastedText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12).map((t) => read(t, /niacinamide/i.test(t) ? "niacinamide" : null)) : [read("Aqua"), read("Niacinamide", "niacinamide"), read("Glycerin"), unread("x"), unread("y")], flags: [], provider: "demo-simulated" },
      };
      return { ok: true, candidate: cand[c] };
    },
    async mix(req) {
      await wait(400);
      const a = subjectFor(req.a);
      const b = subjectFor(req.b);
      return { result: evaluatePair(a, b, DEMO_RULES, DEMO_ACCEPTED), names: [a.displayName, b.displayName] };
    },
    async createRota(req) {
      await wait(300);
      const t = now();
      const startDate = skincareDateAt(t, DEMO_TZ);
      const prev = current();
      const rota = buildRota({ rotaId: `demo-rota-${uid().slice(0, 6)}`, weekNumber: prev ? prev.weekNumber + 1 : 1, startDate, timeZone: DEMO_TZ, createdAt: t, products: state.products, context: req.context, ruleSet: DEMO_RULES, accepted: DEMO_ACCEPTED, previousRotaId: prev?.id ?? null });
      state.history = { ...state.history, rotas: [...state.history.rotas.map((r) => (r.id === prev?.id ? { ...r, archivedAt: r.archivedAt ?? t } : r)), rota], currentRotaId: rota.id };
      let mixNote: string | null = null;
      if (req.mixPair) {
        const pa = ensureProductFor(req.mixPair.a);
        const pb = ensureProductFor(req.mixPair.b);
        const result = evaluatePair(subjectFor(req.mixPair.a), subjectFor(req.mixPair.b), DEMO_RULES, DEMO_ACCEPTED);
        if (pa && pb) mixNote = mixNoteForRota(rota, result, { id: pa.id, name: pa.name }, { id: pb.id, name: pb.name });
      }
      return { rota: clone(rota), mixNote };
    },
    async currentRota() {
      await wait(60);
      const r = current();
      return r ? { rota: clone(r) } : null;
    },
    async today() {
      await wait(100);
      const rota = current();
      const rotas = state.history.rotas.slice(-2);
      return { serverNow: now(), timeZone: DEMO_TZ, rota: rota ? clone(rota) : null, rotas: clone(rotas), records: clone(state.records), friends: friendsView() };
    },
    async complete(req) {
      await wait();
      const rec = recordFor(req.rotaId, req.skincareDate);
      const res = applyCompletion(rec, { id: uid(), rotaId: req.rotaId, skincareDate: req.skincareDate, session: req.session, occurredAt: now(), timeZone: DEMO_TZ, idempotencyKey: req.idempotencyKey });
      if (!res.ok) throw new ApiError("validation", `Completion refused: ${res.error}`, 422);
      putRecord(res.record);
      return { record: clone(res.record) };
    },
    async rescue(rotaId, req) {
      await wait(250);
      const rota = state.history.rotas.find((r) => r.id === rotaId);
      if (!rota) throw new ApiError("not_found", "Unknown rota", 404);
      const res = applyRescue(recordFor(rotaId, req.missedSkincareDate), rota, now(), req.idempotencyKey);
      if (!res.ok) throw new ApiError("conflict", `Rescue refused: ${res.error}`, 409);
      putRecord(res.record);
      replaceRota(res.rota);
      return { record: clone(res.record), rota: clone(res.rota) };
    },
    async declineRescue(rotaId, req) {
      await wait();
      const rec = recordFor(rotaId, req.missedSkincareDate);
      putRecord({ ...rec, rescueDeclinedAt: now() });
    },
    async swapRecovery(rotaId, req) {
      await wait();
      const rota = state.history.rotas.find((r) => r.id === rotaId);
      if (!rota) throw new ApiError("not_found", "Unknown rota", 404);
      const idx = rota.days.findIndex((d) => d.skincareDate === req.skincareDate);
      const next = applyRecoverySwap(rota, idx);
      replaceRota(next);
      const rec = recordFor(rotaId, req.skincareDate);
      putRecord({ ...rec, swappedToRecoveryAt: rec.swappedToRecoveryAt ?? now() });
      return { rota: clone(next) };
    },
    async reflect(rotaId, req) {
      await wait();
      const rota = state.history.rotas.find((r) => r.id === rotaId);
      if (!rota) throw new ApiError("not_found", "Unknown rota", 404);
      const next = recordReflection(rota, req.feeling, req.idempotencyKey, now());
      replaceRota(next);
      return { rota: clone(next) };
    },
    async nextRota(req) {
      await wait(300);
      const prev = current();
      if (!prev) throw new ApiError("not_found", "No rota yet", 404);
      const res = startNextWeek(state.history, {
        idempotencyKey: req.idempotencyKey,
        now: now(),
        newRotaId: `demo-rota-${uid().slice(0, 6)}`,
        startDate: nextRotaStart(prev, now()),
        products: state.products,
        build: { context: req.context, ruleSet: DEMO_RULES, accepted: DEMO_ACCEPTED },
      });
      if (res.status === "not_ready") throw new ApiError("conflict", "This week hasn't reached its last day yet", 409);
      state.history = res.history;
      return { rota: clone(res.rota) };
    },
    async createInvite() {
      await wait();
      state.inviteCreated = true;
      return { token: DEMO_INVITE_TOKEN, url: `/i/${DEMO_INVITE_TOKEN}` };
    },
    async invitePreview(token) {
      await wait();
      if (token !== DEMO_INVITE_TOKEN) return { status: "not_found", inviterDisplayName: null, inviterStreak: null };
      return { status: "active", inviterDisplayName: DEMO_FRIEND.name, inviterStreak: 12 };
    },
    async acceptInvite(token) {
      await wait(250);
      if (token !== DEMO_INVITE_TOKEN) throw new ApiError("not_found", "This invite link doesn't exist", 404);
      const already = state.friends.some((f) => f.summary.pairId === "pair-ama");
      if (!already) {
        const rota = current();
        state.friends.push({
          summary: { pairId: "pair-ama", displayName: DEMO_FRIEND.name, initials: DEMO_FRIEND.initials, joinedAt: now(), newlyJoined: false },
          records: rota ? friendRecords(rota, skincareDateAt(now(), DEMO_TZ), 6, true) : [],
        });
      }
      return { friend: friendsView().find((f) => f.pairId === "pair-ama")!, alreadyPaired: already };
    },
    async friends() {
      await wait();
      return { friends: friendsView(), inviteToken: state.inviteCreated ? DEMO_INVITE_TOKEN : null };
    },
    async markFriendSeen(pairId) {
      const f = state.friends.find((x) => x.summary.pairId === pairId);
      if (f) f.summary.newlyJoined = false;
    },
    async share(req) {
      await wait();
      return { url: req.card.deepLink, imageUrl: null };
    },
    async reminders() {
      return clone(state.reminders);
    },
    async putReminders(req) {
      await wait();
      state.reminders = { am: req.am, pm: req.pm, enabled: req.enabled, timeZone: req.timeZone, pushSubscribed: !!req.subscription };
      return clone(state.reminders);
    },
    async startGoogleClaim() {
      await wait(300);
      throw new ApiError("unavailable", "Google sign-in isn't connected in demo mode. Nothing was saved.", 503);
    },
    async sendEmailCode() {
      await wait(300);
      throw new ApiError("unavailable", "Email codes aren't connected in demo mode. Nothing was sent.", 503);
    },
    async verifyEmailCode() {
      await wait(300);
      throw new ApiError("unavailable", "Email sign-in isn't connected in demo mode.", 503);
    },
    async claimStatus() {
      return { state: "none", correlationId: null };
    },
  };
  return repo;
}
