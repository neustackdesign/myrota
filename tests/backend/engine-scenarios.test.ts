/**
 * Issue #19 engine scenarios A–G through the REAL server evidence path:
 * pasted INCI → splitInciList/toInciIngredients, a photographed Drug Facts
 * transcript → parseFrontLabel, then the live scheduler with the live (empty,
 * no-clinical-rules) RuleSet that rota-store uses. No demo or test rules.
 *
 * Offline twin of tests/acceptance/shelf-scenarios.mjs (which runs the same
 * invariants against the deployed staging Worker).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLabelActive, splitInciList, toInciIngredients } from "../../lib/server/inci";
import { parseFrontLabel } from "../../lib/server/extract-front";
import { buildRota, STRONG_NIGHTS_PER_WEEK } from "../../lib/domain/scheduler";
import { computeStreak, listMisses, qualifies, applyRescue } from "../../lib/domain/records";
import { recordsForRota, reviseRota } from "../../lib/domain/week";
import { isStrongActive } from "../../lib/domain/types";
import type { ActiveClass, DayRecord, RotaSnapshot, RuleSet, ShelfProduct } from "../../lib/domain/types";

const LIVE_RULES: RuleSet = { version: "pending-reviewed-rules-v1", timingRules: [], pairRules: [], contextHoldRules: [] };
const TZ = "Africa/Lagos";
const START = "2026-10-12";

function shelf(id: string, category: ShelfProduct["category"], over: Partial<ShelfProduct> = {}): ShelfProduct {
  return {
    id, brand: "", name: id, category, format: "unknown", identityStatus: "user_confirmed", inciStatus: "unknown",
    ingredients: [], flags: [], source: "manual",
    createdAt: "2026-10-12T05:00:00.000Z", updatedAt: "2026-10-12T05:00:00.000Z", ...over,
  };
}
/** A product added by pasting its ingredient list (user-confirmed, never verified). */
const pasted = (id: string, category: ShelfProduct["category"], inci: string) =>
  shelf(id, category, { source: "paste", inciStatus: "user_confirmed", ingredients: toInciIngredients(splitInciList(inci), id) });

const CLEANSER = shelf("cleanser", "cleanser");
const MOISTURISER = shelf("moisturiser", "moisturiser");
const RETINOL = pasted("retinol-serum", "serum",
  "Squalane, Caprylic/Capric Triglyceride, Retinol, Tocopherol, Ascorbyl Palmitate, Helianthus Annuus Seed Oil");
const GLYCOLIC = pasted("glycolic-toner", "toner",
  "Aqua (Water), Glycolic Acid, Rosa Damascena Flower Water, Glycerin, Aloe Barbadensis Leaf Water, Sodium Hydroxide, Panthenol");
const PHA = pasted("pha-toner", "toner", "Aqua, Gluconolactone, Lactobionic Acid, Glycerin, Panthenol");
const VITC = pasted("vitc-serum", "serum", "Aqua, Ascorbic Acid, Glycerin, Ferulic Acid");
const NIACINAMIDE = pasted("niacinamide-serum", "serum", "Aqua, Niacinamide, Zinc PCA, Pentylene Glycol");

/** The real Shiseido Clear Sunscreen Stick Drug Facts transcript (tests/backend/front-label.test.ts). */
function shiseidoFromPhoto(): ShelfProduct {
  const front = parseFrontLabel(JSON.stringify({
    visible_text: "SHISEIDO CLEAR SUNSCREEN STICK Active ingredients\nAVOBENZONE 2.5%\nHOMOSALATE 10.0%\nOCTISALATE 5.0%\nOCTOCRYLENE 10.0%\nSHISEIDO AMERICAS CORPORATION DIST. MADE IN U.S.A. 20g NET WT .7 OZ OPEN",
    brand: "Shiseido", name: "Clear Sunscreen Stick", category: "sunscreen", size: "20g",
  }));
  assert.ok(front, "Drug Facts transcript must parse");
  return shelf("shiseido", front.category ?? "other", {
    brand: front.brand ?? "", name: front.name ?? "", source: "scan", inciStatus: "unknown",
    // As lib/server/shelf-store.ts does on save: classify each printed active server-side.
    labelActives: front.labelActives.map((a) => ({ ...a, activeClass: classifyLabelActive(a.name) })),
  });
}

function rota(products: ShelfProduct[], over: Partial<Parameters<typeof buildRota>[0]> = {}) {
  return buildRota({
    rotaId: "rota-1", weekNumber: 1, startDate: START, timeZone: TZ, createdAt: "2026-10-12T05:00:00.000Z",
    products, context: {}, ruleSet: LIVE_RULES, ...over,
  });
}
const pmClasses = (r: RotaSnapshot, day: number): ActiveClass[] => r.days[day].pm.flatMap((s) => (s.activeClass ? [s.activeClass] : []));
const strongNight = (r: RotaSnapshot, day: number) => pmClasses(r, day).some(isStrongActive);
const exfoliantNight = (r: RotaSnapshot, day: number) => pmClasses(r, day).some((c) => c === "aha" || c === "bha" || c === "pha");
const scheduled = (r: RotaSnapshot) => new Set(r.days.flatMap((d) => [...d.am, ...d.pm].flatMap((s) => (s.activeClass ? [s.activeClass] : []))));

function assertSpfLast(r: RotaSnapshot) {
  for (const d of r.days) {
    const i = d.am.findIndex((s) => s.category === "sunscreen");
    if (i >= 0) assert.equal(i, d.am.length - 1, `day ${d.index}: sunscreen must be the last AM step`);
    assert.ok(!d.pm.some((s) => s.category === "sunscreen"), `day ${d.index}: no sunscreen at night`);
  }
}
function assertRecoverySpacing(r: RotaSnapshot) {
  const nights = r.days.filter((d) => strongNight(r, d.index)).length;
  assert.ok(nights <= STRONG_NIGHTS_PER_WEEK, `≤${STRONG_NIGHTS_PER_WEEK} strong nights, got ${nights}`);
  for (let d = 0; d < 6; d += 1) {
    if (exfoliantNight(r, d)) assert.ok(!strongNight(r, d + 1), `night after exfoliant night ${d} must have no retinoid/exfoliant`);
    if (strongNight(r, d) && strongNight(r, d + 1)) {
      const a = r.days[d].pm.find((s) => s.activeClass && isStrongActive(s.activeClass))!.productId;
      const b = r.days[d + 1].pm.find((s) => s.activeClass && isStrongActive(s.activeClass))!.productId;
      assert.equal(a, b, `different strong products on back-to-back nights ${d},${d + 1}`);
    }
  }
}

test("A · pasted INCI: retinol recognised from a user-pasted list and scheduled at night with a reason", () => {
  assert.equal(RETINOL.inciStatus, "user_confirmed");
  assert.ok(RETINOL.ingredients.some((i) => i.activeClass === "retinoid"));
  const r = rota([CLEANSER, RETINOL, MOISTURISER]);
  const nights = r.days.filter((d) => d.pm.some((s) => s.productId === RETINOL.id));
  assert.ok(nights.length >= 2, "retinoid actually scheduled");
  assert.ok(r.days.every((d) => !d.am.some((s) => s.productId === RETINOL.id)), "never AM");
  for (const d of nights) {
    const step = d.pm.find((s) => s.productId === RETINOL.id)!;
    assert.equal(step.label, "provisional");
    assert.match(step.reason ?? "", /evening/);
    assert.ok(d.pm.indexOf(step) < d.pm.findIndex((s) => s.productId === MOISTURISER.id), "treatment before moisturiser");
  }
});

test("B · Shiseido photo: Drug Facts UV filters drive sunscreen planning without claiming a full formula", () => {
  const spf = shiseidoFromPhoto();
  assert.equal(spf.category, "sunscreen");
  assert.deepEqual(spf.labelActives?.map((a) => a.name.toLowerCase()), ["avobenzone", "homosalate", "octisalate", "octocrylene"]);
  assert.ok(spf.labelActives?.every((a) => a.activeClass === "uv_filter"));
  assert.equal(spf.inciStatus, "unknown", "full INCI stays unknown");
  assert.deepEqual(spf.ingredients, []);
  const r = rota([CLEANSER, MOISTURISER, spf]);
  assert.ok(r.days.every((d) => d.am.at(-1)?.productId === spf.id), "every morning ends with the Shiseido stick");
  assert.ok(r.held.every((h) => h.productId !== spf.id), "not held");
  assertSpfLast(r);
});

test("C · SPF-last ordering survives vitamin C, moisturiser and an unanalysed sunscreen", () => {
  const unknownSpf = shelf("unknown-spf", "sunscreen", { placement: "am" });
  const r = rota([unknownSpf, MOISTURISER, VITC, CLEANSER]);
  assertSpfLast(r);
  for (const d of r.days) {
    assert.deepEqual(d.am.map((s) => s.productId), ["cleanser", "vitc-serum", "moisturiser", "unknown-spf"]);
  }
});

test("D · PHA + SPF + moisturiser: PHA on spaced nights, recovery night after each", () => {
  const r = rota([PHA, shiseidoFromPhoto(), MOISTURISER]);
  assert.ok(scheduled(r).has("pha"));
  assertRecoverySpacing(r);
  assertSpfLast(r);
});

test("E · vitamin C + niacinamide: gentle daily actives share mornings", () => {
  const r = rota([VITC, NIACINAMIDE, MOISTURISER]);
  assert.ok(r.days.every((d) => ["vitc-serum", "niacinamide-serum"].every((id) => [...d.am, ...d.pm].some((s) => s.productId === id))));
  assert.equal(r.held.length, 0);
});

test("F · retinoid + exfoliant alternate with recovery nights between them (≤4 strong nights)", () => {
  const r = rota([CLEANSER, RETINOL, GLYCOLIC, MOISTURISER, shiseidoFromPhoto()]);
  const has = scheduled(r);
  assert.ok(has.has("retinoid") && has.has("aha"), "both strong actives scheduled");
  for (const d of r.days) {
    assert.ok(pmClasses(r, d.index).filter(isStrongActive).length <= 1, `day ${d.index}: one strong active per night`);
  }
  assertRecoverySpacing(r);
  // At least one recovery night between every retinoid night and every exfoliant night.
  const ret = r.days.filter((d) => pmClasses(r, d.index).includes("retinoid")).map((d) => d.index);
  const aha = r.days.filter((d) => pmClasses(r, d.index).includes("aha")).map((d) => d.index);
  for (const a of ret) for (const b of aha) assert.ok(Math.abs(a - b) >= 2, `retinoid night ${a} and AHA night ${b} need a recovery night between`);
  // The reason is on the step: strong steps explain the spacing; the night after an exfoliant explains recovery.
  for (const d of r.days) for (const s of d.pm) if (s.activeClass && isStrongActive(s.activeClass)) assert.match(s.reason ?? "", /recovery night/);
  for (const n of aha) if (n < 6) assert.match(r.days[n + 1].pm.find((s) => s.productId === MOISTURISER.id)?.reason ?? "", /Recovery night after last night's exfoliant/);
  assertSpfLast(r);
  // Week boundary: if this week ends on a strong night, next week's first night is not an exfoliant.
  const next = rota([CLEANSER, RETINOL, GLYCOLIC, MOISTURISER], { rotaId: "rota-2", startDate: "2026-10-19", previousFinalNight: pmClasses(r, 6) });
  if (exfoliantNight(r, 6)) assert.ok(!strongNight(next, 0));
  if (strongNight(r, 6)) assert.ok(!exfoliantNight(next, 0));
  assertRecoverySpacing(next);
});

// --- G: replan continuity ---------------------------------------------------

function completed(r: RotaSnapshot, day: number, at: string): DayRecord {
  const d = r.days[day];
  const sessions = (["am", "pm"] as const).filter((k) => d[k].length);
  return {
    rotaId: r.id, skincareDate: d.skincareDate, timeZone: TZ, scheduled: { am: d.am.length > 0, pm: d.pm.length > 0 },
    events: sessions.map((s, i) => ({ id: `e-${day}-${s}`, rotaId: r.id, skincareDate: d.skincareDate, session: s, occurredAt: at, timeZone: TZ, idempotencyKey: `k-${day}-${s}-${i}` })),
  };
}
const empty = (r: RotaSnapshot, day: number): DayRecord => ({ ...completed(r, day, ""), events: [] });

test("G · adding a retinoid after completing day 0 replans the week without touching day 0, streak or Rescue", () => {
  const before = [CLEANSER, MOISTURISER, shiseidoFromPhoto()];
  const week = rota(before, { rotaId: "week-v1" });
  assert.ok(!scheduled(week).has("retinoid"));
  const day0 = completed(week, 0, "2026-10-12T19:00:00.000Z"); // 20:00 Lagos
  const records = [day0];
  const now = "2026-10-12T20:00:00.000Z";
  const streakBefore = computeStreak({ records, rotas: [week], now, timeZone: TZ });
  const missesBefore = listMisses(records, [week], now);
  assert.equal(streakBefore.earned, 1);

  const revised = reviseRota(week, { newRotaId: "week-v2", now, products: [...before, RETINOL], records, build: { context: {}, ruleSet: LIVE_RULES } });
  assert.ok(revised);
  // The Rota changes: the retinoid is now planned, on a later night.
  assert.ok(scheduled(revised).has("retinoid"), "rota reacts to the Shelf change");
  assert.ok(!revised.days[0].pm.some((s) => s.productId === RETINOL.id), "completed day 0 is not re-planned");
  assert.deepEqual(revised.days[0], week.days[0]);
  // Same week identity.
  assert.equal(revised.startDate, week.startDate);
  assert.equal(revised.weekNumber, week.weekNumber);
  assert.deepEqual(revised.supersedes, ["week-v1"]);
  // Day 0 stays completed when viewed through the new revision.
  const view = recordsForRota(revised, records);
  assert.ok(qualifies(view[0]), "day 0 still completed after the replan");
  assert.equal(view[0], day0, "the original record, untouched");
  // Streak and Rescue unchanged.
  const rotas = [{ ...week, archivedAt: now }, revised];
  assert.deepEqual(computeStreak({ records, rotas, now, timeZone: TZ }), streakBefore);
  assert.deepEqual(listMisses(records, rotas, now), missesBefore);
  assert.equal(revised.rescueUsedFor ?? null, week.rescueUsedFor ?? null);
});

test("G2 · mid-week replan keeps a pending miss Rescue-eligible and a spent Rescue spent", () => {
  const base = [CLEANSER, GLYCOLIC, MOISTURISER];
  const week = rota(base, { rotaId: "wk-v1" });
  const records = [completed(week, 0, "2026-10-12T19:00:00.000Z"), empty(week, 1)];
  const now = "2026-10-14T08:00:00.000Z"; // day 2 morning: day 1 missed, still rescuable
  const streakBefore = computeStreak({ records, rotas: [week], now, timeZone: TZ });
  const missesBefore = listMisses(records, [week], now);
  assert.equal(missesBefore[0].status, "eligible");

  const revised = reviseRota(week, { newRotaId: "wk-v2", now, products: [...base, RETINOL], records, build: { context: {}, ruleSet: LIVE_RULES } })!;
  assert.deepEqual(revised.days.slice(0, 2), week.days.slice(0, 2), "past days keep their plan");
  assertRecoverySpacing(revised);
  const rotas = [{ ...week, archivedAt: now }, revised];
  assert.deepEqual(computeStreak({ records, rotas, now, timeZone: TZ }), streakBefore);
  assert.deepEqual(listMisses(records, rotas, now), missesBefore);

  // Rescue the old-revision miss through the CURRENT revision; a further replan keeps it spent.
  const rescued = applyRescue(records[1], revised, now, "rescue-key-1");
  assert.ok(rescued.ok);
  const third = reviseRota(rescued.rota, { newRotaId: "wk-v3", now, products: base, records: [records[0], rescued.record], build: { context: {}, ruleSet: LIVE_RULES } })!;
  assert.equal(third.rescueUsedFor, week.days[1].skincareDate);
  assert.deepEqual(third.supersedes, ["wk-v1", "wk-v2"]);
  assert.equal(recordsForRota(third, [records[0], rescued.record])[1].rescue?.idempotencyKey, "rescue-key-1");
});

test("G3 · a finished week is not revised (start the next week instead)", () => {
  const week = rota([CLEANSER, MOISTURISER], { rotaId: "old" });
  assert.equal(reviseRota(week, { newRotaId: "x", now: "2026-10-20T08:00:00.000Z", products: [CLEANSER], records: [], build: { context: {}, ruleSet: LIVE_RULES } }), null);
});
