/**
 * Launch regression scenarios from CLAUDE.md that live in pure domain logic.
 * Scenario 11 (iOS Safari ↔ Home Screen continuity) and the backend half of
 * 13 (merge transaction) are device / infra tests and are tracked in
 * docs/UI_HANDOFF_V1_2.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { confirmIdentity, correctIngredient, evidenceActiveClasses, isAnalysable, regulatoryAlertApplies, removeIngredient, visibleSafetyFlags } from "../../lib/domain/evidence";
import { computeFriendStreak } from "../../lib/domain/friend-streak";
import { evaluatePair, shelfToMixSubject, unknownMixSubject } from "../../lib/domain/mix";
import { applyCompletion, applyRescue, computeStreak, dayStatus, listMisses, rescueExpiresAt, streakIfRescued } from "../../lib/domain/records";
import { applyRecoverySwap, buildRota, daysWith, mixNoteForRota, spreadDays } from "../../lib/domain/scheduler";
import { buildShareCard } from "../../lib/domain/share";
import { addDays, skincareDateAt, skincareDayEnd, skincareDayStart, zonedWallTimeToInstant } from "../../lib/domain/skincare-day";
import { buildTodayView } from "../../lib/domain/today";
import type { DayRecord, RegulatoryNotice, RotaSnapshot, SafetyFlag, ShelfProduct } from "../../lib/domain/types";
import { PRODUCTION_ACCEPTED } from "../../lib/domain/types";
import { recordReflection, startNextWeek, summarizeWeek, type RotaHistory } from "../../lib/domain/week";
import { segmentFor, toPrototypeTones } from "../../lib/ui/ring";
import { TEST_REVIEWER, TEST_RULES, done, product, record } from "./fixtures";

const LAGOS = "Africa/Lagos";
const DUBAI = "Asia/Dubai";
const REVIEWED = ["reviewed"] as const;

function rotaFrom(products: ShelfProduct[], start = "2026-10-05", id = "rota-1", over: Partial<Parameters<typeof buildRota>[0]> = {}) {
  return buildRota({
    rotaId: id,
    weekNumber: 1,
    startDate: start,
    timeZone: LAGOS,
    createdAt: "2026-10-05T06:00:00.000Z",
    products,
    context: {},
    ruleSet: TEST_RULES,
    accepted: REVIEWED,
    ...over,
  });
}

function weekRecords(rota: RotaSnapshot, completeIdx: number[], tz = LAGOS): DayRecord[] {
  return rota.days.map((d, i) => {
    const r = record(rota.id, d.skincareDate, tz, { am: d.am.length > 0, pm: d.pm.length > 0 });
    if (!completeIdx.includes(i)) return r;
    const sessions = d.am.length || d.pm.length ? (["am", "pm"] as const).filter((k) => d[k].length) : (["rest"] as const);
    return done(r, `${d.skincareDate}T19:00:00.000Z`, [...sessions]);
  });
}

// ---------------------------------------------------------------------------
test("1 · correcting every ingredient chip never crashes and stays unverified", () => {
  let p = product("serum", "serum", ["niacinamide"]);
  assert.equal(isAnalysable(p), true);
  for (const ing of p.ingredients) p = correctIngredient(p, ing.id, `typed ${ing.text}`);
  assert.equal(p.inciStatus, "corrected");
  assert.equal(isAnalysable(p), false);
  assert.deepEqual(evidenceActiveClasses(p), []);
  assert.ok(p.ingredients.every((i) => i.status === "corrected" && !i.activeClass));
  // Removing every line is also safe.
  let q = product("q", "serum", ["niacinamide"]);
  for (const ing of [...q.ingredients]) q = removeIngredient(q, ing.id);
  assert.equal(q.inciStatus, "unknown");
  // A corrected product can never produce a confident Mix verdict.
  const r = evaluatePair(shelfToMixSubject(p), shelfToMixSubject(product("c", "serum", ["vitamin_c"])), TEST_RULES, REVIEWED);
  assert.equal(r.verdict, "insufficient_evidence");
});

test("1b · confirming the name never upgrades ingredient confidence", () => {
  const partial = product("p", "serum", [], { identityStatus: "unknown", inciStatus: "partial" });
  const named = confirmIdentity(partial, "Daily Glow Serum");
  assert.equal(named.identityStatus, "user_confirmed");
  assert.equal(named.inciStatus, "partial");
  const verified = product("v", "serum");
  assert.equal(confirmIdentity(verified, "Different name").identityStatus, "corrected");
});

// ---------------------------------------------------------------------------
test("2 · startNextWeek archives the first rota exactly once and the streak survives", () => {
  const products = [product("cleanser", "cleanser"), product("ret", "treatment", ["retinoid"])];
  const week1 = rotaFrom(products);
  let history: RotaHistory = { rotas: [week1], currentRotaId: week1.id, appliedKeys: [] };
  const args = {
    idempotencyKey: "next-1",
    now: "2026-10-12T05:00:00.000Z",
    newRotaId: "rota-2",
    startDate: "2026-10-12",
    products,
    build: { context: {}, ruleSet: TEST_RULES, accepted: REVIEWED },
  };
  const first = startNextWeek(history, args);
  const replay = startNextWeek(first.history, args);
  const otherKey = startNextWeek(replay.history, { ...args, idempotencyKey: "next-2", newRotaId: "rota-3" });
  history = otherKey.history;
  assert.equal(first.status, "started");
  assert.equal(replay.status, "duplicate");
  assert.equal(otherKey.status, "not_ready", "a fresh key cannot archive week 2 on its first day");
  // Too early for week 1 too: starting before its last day is refused.
  const early = startNextWeek({ rotas: [week1], currentRotaId: week1.id, appliedKeys: [] }, { ...args, now: "2026-10-08T10:00:00.000Z" });
  assert.equal(early.status, "not_ready");
  assert.equal(history.rotas.length, 2);
  assert.equal(history.rotas.filter((r) => r.archivedAt).length, 1);
  assert.equal(history.currentRotaId, "rota-2");
  assert.equal(first.rota.weekNumber, 2);
  assert.equal(first.rota.previousRotaId, "rota-1");

  const week2 = first.rota;
  const records = [...weekRecords(week1, [0, 1, 2, 3, 4, 5, 6]), ...weekRecords(week2, [0])];
  const streak = computeStreak({ records, rotas: history.rotas, now: "2026-10-12T20:00:00.000Z", timeZone: LAGOS });
  assert.equal(streak.continuity, 8);
  assert.equal(streak.earned, 8);
});

// ---------------------------------------------------------------------------
test("3 · Mix→rota note reflects the real verdict and the real plan", () => {
  const ret = product("Retinal", "treatment", ["retinoid"]);
  const bha = product("BHA", "treatment", ["bha"]);
  const vitc = product("VitC", "serum", ["vitamin_c"]);
  const niac = product("Niac", "serum", ["niacinamide"]);
  const aza = product("Aza", "treatment", ["azelaic_acid"]);
  const shea = product("Shea", "other", [], { inciStatus: "unknown", identityStatus: "unknown", placement: "pm" });

  const alt = evaluatePair(shelfToMixSubject(ret), shelfToMixSubject(bha), TEST_RULES, REVIEWED);
  assert.equal(alt.verdict, "alternate_days");
  const rota1 = rotaFrom([ret, bha, product("Cleanser", "cleanser")]);
  assert.ok(!daysWith(rota1, ret.id).some((d) => daysWith(rota1, bha.id).includes(d)));
  assert.match(mixNoteForRota(rota1, alt, { id: ret.id, name: "Retinal" }, { id: bha.id, name: "BHA" }), /never share a day/);
  // Shelf Check names the capped treatments, never a daily active.
  const withVitc = rotaFrom([ret, bha, vitc]);
  assert.match(withVitc.shelfCheck.find((o) => o.id === "separation")!.text, /^(Retinal and BHA|BHA and Retinal) are on different days/);

  const fine = evaluatePair(shelfToMixSubject(niac), shelfToMixSubject(vitc), TEST_RULES, REVIEWED);
  assert.equal(fine.verdict, "fine_together");
  const rota2 = rotaFrom([niac, vitc]);
  assert.match(mixNoteForRota(rota2, fine, { id: niac.id, name: "Niac" }, { id: vitc.id, name: "VitC" }), /fine together/);

  const unreviewed = evaluatePair(shelfToMixSubject(ret), shelfToMixSubject(aza), TEST_RULES, REVIEWED);
  assert.equal(unreviewed.verdict, "insufficient_evidence");
  assert.equal(unreviewed.basis, "unreviewed_pair");
  const rota3 = rotaFrom([ret, aza]);
  assert.ok(!daysWith(rota3, ret.id).some((d) => daysWith(rota3, aza.id).includes(d)), "unreviewed actives never share a day");
  assert.match(mixNoteForRota(rota3, unreviewed, { id: ret.id, name: "Retinal" }, { id: aza.id, name: "Aza" }), /couldn't confirm/);

  const unknown = evaluatePair(shelfToMixSubject(ret), shelfToMixSubject(shea), TEST_RULES, REVIEWED);
  assert.equal(unknown.verdict, "insufficient_evidence");
  assert.equal(unknown.basis, "unknown_product");
  assert.deepEqual(unknown.activeClasses[1], []);
  assert.equal(evaluatePair(shelfToMixSubject(ret), unknownMixSubject("u", "Makola shea"), TEST_RULES, REVIEWED).verdict, "insufficient_evidence");

  // A draft rule is never trusted, and production accepts reviewed rules only.
  const aha = product("AHA", "treatment", ["aha"]);
  assert.equal(evaluatePair(shelfToMixSubject(aha), shelfToMixSubject(niac), TEST_RULES, PRODUCTION_ACCEPTED).verdict, "insufficient_evidence");
  const demoOnly = { ...TEST_RULES, pairRules: TEST_RULES.pairRules.map((r) => ({ ...r, status: "demo_fixture" as const })) };
  assert.equal(evaluatePair(shelfToMixSubject(ret), shelfToMixSubject(bha), demoOnly, PRODUCTION_ACCEPTED).verdict, "insufficient_evidence");
});

test("3b · without reviewed timing rules, actives are held, never guessed", () => {
  const rota = buildRota({
    rotaId: "r", weekNumber: 1, startDate: "2026-10-05", timeZone: LAGOS, createdAt: "2026-10-05T06:00:00.000Z",
    products: [product("ret", "treatment", ["retinoid"]), product("cleanser", "cleanser")],
    context: {}, ruleSet: { version: "empty", pairRules: [], timingRules: [], contextHoldRules: [] },
  });
  assert.deepEqual(rota.held, [{ productId: "ret", reason: "insufficient_evidence" }]);
  assert.ok(rota.days.every((d) => ![...d.am, ...d.pm].some((s) => s.productId === "ret")));
});

test("3c · context holds come only from reviewed rules and the user's own answer", () => {
  const products = [product("ret", "treatment", ["retinoid"]), product("cleanser", "cleanser")];
  const held = rotaFrom(products, "2026-10-05", "r", { context: { care: "pregnant_or_breastfeeding" } });
  assert.deepEqual(held.held, [{ productId: "ret", reason: "context_hold" }]);
  const skipped = rotaFrom(products, "2026-10-05", "r", { context: { care: "prefer_not_to_say" } });
  assert.equal(skipped.held.length, 0);
  const isNew = rotaFrom(products, "2026-10-05", "r", { context: { retinoidExperience: "new" } });
  assert.equal(daysWith(isNew, "ret").length, 2);
  assert.deepEqual(spreadDays(3), [0, 2, 4]);
});

// ---------------------------------------------------------------------------
test("4 · a missed day stays Rescue-eligible after later rollovers and across the week boundary", () => {
  const products = [product("cleanser", "cleanser")];
  const week1 = rotaFrom(products);
  const week2 = rotaFrom(products, "2026-10-12", "rota-2");
  // Day 7 (Sunday 11 Oct) missed. Now: Monday 12 Oct 20:00 Lagos, already in week 2.
  const records = [...weekRecords(week1, [0, 1, 2, 3, 4, 5]), ...weekRecords(week2, [])];
  const now = "2026-10-12T19:00:00.000Z";
  const misses = listMisses(records, [week1, week2], now);
  const sunday = misses.find((m) => m.skincareDate === "2026-10-11");
  assert.equal(sunday?.status, "eligible");
  assert.equal(sunday?.rotaId, "rota-1");
  const view = buildTodayView({ rota: week2, rotas: [week1, week2], records, now, timeZone: LAGOS });
  assert.equal(view.rescueOffer?.skincareDate, "2026-10-11");
  assert.equal(view.streak.state, "at_risk");
  assert.equal(view.streak.continuity, 6);

  // Two pending misses in one rota: both listed, the soonest-expiring is offered,
  // and after one Rescue the other is named as unrescuable — never erased.
  const recs2 = weekRecords(week1, [0]);
  const now2 = "2026-10-08T20:00:00.000Z";
  const both = listMisses(recs2, [week1], now2);
  assert.deepEqual(both.map((m) => [m.skincareDate, m.status]), [["2026-10-06", "eligible"], ["2026-10-07", "eligible"]]);
  const v2 = buildTodayView({ rota: week1, rotas: [week1], records: recs2, now: now2, timeZone: LAGOS });
  assert.equal(v2.rescueOffer?.skincareDate, "2026-10-06");
  const rescued = applyRescue(recs2[1], week1, now2, "k1");
  assert.ok(rescued.ok);
  if (!rescued.ok) return;
  const recs3 = [recs2[0], rescued.record, ...recs2.slice(2)];
  const v3 = buildTodayView({ rota: rescued.rota, rotas: [rescued.rota], records: recs3, now: now2, timeZone: LAGOS });
  assert.equal(v3.rescueOffer, null);
  assert.deepEqual(v3.unrescuable.map((m) => [m.skincareDate, m.status]), [["2026-10-07", "rota_rescue_used"]]);
  // An older miss that already expired is still listed, with its real status.
  const m4 = listMisses(weekRecords(week1, [0, 3]), [week1], "2026-10-09T20:00:00.000Z");
  assert.deepEqual(m4.map((m) => [m.skincareDate, m.status]), [["2026-10-06", "expired"], ["2026-10-07", "eligible"]]);
});

// ---------------------------------------------------------------------------
test("5 · Rescue expires exactly 48h after the 04:00 rollover that ends the missed day", () => {
  // CLAUDE.md example: miss Monday → day closes Tue 04:00 → Rescue expires Thu 04:00 local.
  assert.equal(rescueExpiresAt("2026-10-05", LAGOS).toISOString(), "2026-10-08T03:00:00.000Z");
  const week1 = rotaFrom([product("cleanser", "cleanser")]);
  const records = weekRecords(week1, [1, 2]);
  const monday = records[0];
  const before = new Date(Date.parse("2026-10-08T03:00:00.000Z") - 1).toISOString();
  assert.equal(listMisses([monday], [week1], before)[0].status, "eligible");
  assert.equal(listMisses([monday], [week1], "2026-10-08T03:00:00.000Z")[0].status, "expired");
  const late = applyRescue(monday, week1, "2026-10-08T03:00:00.000Z", "k");
  assert.deepEqual(late, { ok: false, error: "expired" });
  // Expired is final: the streak no longer waits for it.
  const s = computeStreak({ records, rotas: [week1], now: "2026-10-08T09:00:00.000Z", timeZone: LAGOS });
  assert.equal(s.state, "active");
  assert.equal(s.continuity, 2);
});

// ---------------------------------------------------------------------------
test("6 · Rescue preserves continuity but never increments earned days", () => {
  const week1 = rotaFrom([product("cleanser", "cleanser")]);
  // Mon–Wed done, Thu missed, Fri (today) done.
  const records = weekRecords(week1, [0, 1, 2, 4]);
  const now = "2026-10-09T20:00:00.000Z";
  const input = { records, rotas: [week1], now, timeZone: LAGOS };
  const held = computeStreak(input);
  assert.equal(held.state, "at_risk");
  assert.equal(held.continuity, 3);
  assert.equal(held.todayCounted, false, "today adds nothing while a miss is pending");
  const preview = streakIfRescued(input, "2026-10-08");
  assert.deepEqual([preview.continuity, preview.earned, preview.rescued], [5, 4, 1]);

  const res = applyRescue(records[3], week1, now, "rescue-1");
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(dayStatus(res.record, "2026-10-09"), "rescued");
  assert.equal(res.rota.rescueUsedFor, "2026-10-08");
  const replay = applyRescue(res.record, res.rota, now, "rescue-1");
  assert.ok(replay.ok && replay.duplicate);
  const after = [...records.slice(0, 3), res.record, ...records.slice(4)];
  const s = computeStreak({ records: after, rotas: [res.rota], now, timeZone: LAGOS });
  assert.deepEqual([s.continuity, s.earned, s.rescued, s.state], [5, 4, 1, "active"]);
  // One Rescue per rota: a second miss in the same rota is unrescuable.
  const second = { ...records[5] };
  const twoMisses = applyRescue(second, res.rota, "2026-10-11T20:00:00.000Z", "rescue-2");
  assert.deepEqual(twoMisses, { ok: false, error: "rota_rescue_used" });
  // A rescued week is "followed", not a 7/7 completion.
  const full = weekRecords(week1, [0, 1, 2, 4, 5, 6]);
  full[3] = res.record;
  const summary = summarizeWeek(res.rota, full, "2026-10-12T05:00:00.000Z");
  assert.deepEqual([summary.earned, summary.rescued, summary.followed, summary.outcome], [6, 1, 7, "week_ended"]);
});

// ---------------------------------------------------------------------------
test("7 · a named regulator alert needs verified SKU + variant + notice; label warnings are separate", () => {
  const notice: RegulatoryNotice = {
    regulator: "Example regulator", reference: "N-1", url: "https://regulator.example/notices/n-1",
    publishedAt: "2026-09-01T00:00:00.000Z", productIdentityKey: "sku:glow", variant: "200ml",
  };
  const alertFlag: SafetyFlag = { id: "a", kind: "regulatory_alert", ruleId: "ALERT", ruleVersion: "1", status: "reviewed", title: "t", body: "b", reviewers: [TEST_REVIEWER], evidenceRefs: ["n-1"], notice };
  const verified = product("glow", "moisturiser", [], { identityKey: "sku:glow", variant: "200ml", flags: [alertFlag] });
  assert.equal(regulatoryAlertApplies(verified, notice), true);
  assert.equal(visibleSafetyFlags(verified).length, 1);
  // OCR guess / typed name: same key text but identity not verified.
  assert.equal(regulatoryAlertApplies({ ...verified, identityStatus: "partial" }, notice), false);
  assert.equal(regulatoryAlertApplies({ ...verified, identityStatus: "user_confirmed" }, notice), false);
  assert.equal(regulatoryAlertApplies({ ...verified, variant: "50ml" }, notice), false);
  assert.equal(regulatoryAlertApplies(verified, { ...notice, url: "" }), false);
  // Label-declared path: requires the flagged ingredient to have actually been read.
  const labelFlag: SafetyFlag = { id: "l", kind: "label_declared", ruleId: "HQ-01", ruleVersion: "1", status: "reviewed", title: "t", body: "b", reviewers: [TEST_REVIEWER], evidenceRefs: ["r"] };
  const hq = product("hq", "moisturiser", [], { identityStatus: "unknown", inciStatus: "partial", flags: [labelFlag] });
  assert.equal(visibleSafetyFlags(hq).length, 0);
  hq.ingredients.push({ id: "hq1", text: "Hydroquinone 2%", status: "read", flagged: true });
  assert.equal(visibleSafetyFlags(hq).length, 1);
  // Draft safety copy never renders in production.
  assert.equal(visibleSafetyFlags({ ...hq, flags: [{ ...labelFlag, status: "draft" }] }).length, 0);
  // A flagged product is held out of the rota.
  const rota = rotaFrom([hq, product("cleanser", "cleanser")]);
  assert.deepEqual(rota.held, [{ productId: "hq", reason: "safety_flag" }]);
});

// ---------------------------------------------------------------------------
test("8 · ring segments distinguish done, recovery, rescued, today, missed and future", () => {
  const kinds = [
    segmentFor(0, "complete", "treatment", false).kind,
    segmentFor(1, "complete", "recovery", false).kind,
    segmentFor(2, "rescued", "treatment", false).kind,
    segmentFor(3, "missed", "treatment", false).kind,
    segmentFor(4, "in_progress", "treatment", true).kind,
    segmentFor(5, "future", "treatment", false).kind,
    segmentFor(6, "future", "recovery", false).kind,
  ];
  assert.deepEqual(kinds, ["done", "recovery_done", "rescued", "missed", "today", "future", "future_recovery"]);
  const tones = toPrototypeTones([segmentFor(0, "missed", "treatment", false), segmentFor(1, "complete", "treatment", false)]);
  assert.deepEqual(tones, ["x", "#2A1911"]);
});

// ---------------------------------------------------------------------------
test("9 · share cards hide names by default and keep verified Mix classes", () => {
  const ret = product("Crystal Retinal", "treatment", ["retinoid"]);
  const bha = product("BHA Liquid", "treatment", ["bha"]);
  const result = evaluatePair(shelfToMixSubject(ret), shelfToMixSubject(bha), TEST_RULES, REVIEWED);
  const card = buildShareCard({ kind: "mix", result, verdictLabel: "Alternate days", productNames: ["Crystal Retinal", "BHA Liquid"] });
  assert.equal(card.namesShown, false);
  assert.deepEqual(card.productNames, []);
  assert.equal(card.subline, "Retinoid · BHA");
  assert.ok(!card.subline.includes("Crystal"));
  const opted = buildShareCard({ kind: "mix", result, verdictLabel: "Alternate days", productNames: ["Crystal Retinal", "BHA Liquid"] }, { showNames: true });
  assert.deepEqual(opted.productNames, ["Crystal Retinal", "BHA Liquid"]);
  const unk = evaluatePair(shelfToMixSubject(ret), unknownMixSubject("u", "Shea"), TEST_RULES, REVIEWED);
  const unkCard = buildShareCard({ kind: "mix", result: unk, verdictLabel: "Not enough evidence", productNames: ["a", "b"] });
  assert.equal(unkCard.subline, "Retinoid · Not confirmed");
  const friend = buildShareCard({ kind: "friend", pairStreak: 4, myName: "Kemi", friendName: "Ama", inviteToken: "tok" });
  assert.equal(friend.subline, "Me and a friend");
  assert.equal(friend.deepLink, "/i/tok");
  for (const c of [card, opted, unkCard, friend]) {
    const json = JSON.stringify(c);
    assert.ok(!/pregnan|prescription|retinoidExperience|care/i.test(json));
    assert.ok(c.deepLink.startsWith("/"));
  }
});

// ---------------------------------------------------------------------------
test("10 · 04:00 user-local rollover, offsets and DST", () => {
  assert.equal(skincareDateAt("2026-10-09T02:59:00.000Z", LAGOS), "2026-10-08"); // 03:59 Lagos
  assert.equal(skincareDateAt("2026-10-09T03:00:00.000Z", LAGOS), "2026-10-09"); // 04:00 Lagos
  assert.equal(skincareDateAt("2026-10-08T22:00:00.000Z", DUBAI), "2026-10-08"); // 02:00 Dubai on the 9th
  assert.equal(skincareDateAt("2026-10-09T00:00:00.000Z", DUBAI), "2026-10-09"); // 04:00 Dubai
  // Half-hour offset: 22:00Z = 03:30 IST on the 9th, before 04:00, so still the 8th.
  assert.equal(skincareDateAt("2026-10-08T22:00:00.000Z", "Asia/Kolkata"), "2026-10-08");
  assert.equal(skincareDateAt("2026-10-08T22:30:00.000Z", "Asia/Kolkata"), "2026-10-09");

  // DST fall-back (London, 25 Oct 2026): that skincare day lasts 25 hours.
  const start = skincareDayStart("2026-10-24", "Europe/London").toISOString();
  const end = skincareDayEnd("2026-10-24", "Europe/London").toISOString();
  assert.deepEqual([start, end], ["2026-10-24T03:00:00.000Z", "2026-10-25T04:00:00.000Z"]);
  // DST spring-forward (New York, 14 Mar 2027): 23 hours; a wall time in the gap resolves forward.
  assert.equal(skincareDayEnd("2027-03-13", "America/New_York").getTime() - skincareDayStart("2027-03-13", "America/New_York").getTime(), 23 * 3_600_000);
  assert.equal(zonedWallTimeToInstant("2027-03-14", 2, "America/New_York").toISOString(), "2027-03-14T07:00:00.000Z");

  // Session completion: 00:40 still counts for the previous day; outside the window is rejected.
  const r = record("rota-1", "2026-10-08", LAGOS);
  const ev = (at: string, key: string, session: "am" | "pm" | "rest" = "pm") => ({
    id: key, rotaId: "rota-1", skincareDate: "2026-10-08", session, occurredAt: at, timeZone: LAGOS, idempotencyKey: key,
  });
  const late = applyCompletion(r, ev("2026-10-08T23:40:00.000Z", "late"));
  assert.ok(late.ok && !late.duplicate);
  assert.deepEqual(applyCompletion(r, ev("2026-10-09T03:00:00.000Z", "after")), { ok: false, error: "outside_skincare_day" });
  assert.deepEqual(applyCompletion(r, ev("2026-10-08T02:00:00.000Z", "before")), { ok: false, error: "outside_skincare_day" });
  if (late.ok) {
    const replay = applyCompletion(late.record, ev("2026-10-08T23:40:00.000Z", "late"));
    assert.ok(replay.ok && replay.duplicate && replay.record.events.length === 1);
  }
  assert.deepEqual(applyCompletion(r, ev("2026-10-08T20:00:00.000Z", "rest", "rest")), { ok: false, error: "rest_not_allowed" });
  assert.deepEqual(applyCompletion({ ...r, rotaId: "other" }, ev("2026-10-08T20:00:00.000Z", "x")), { ok: false, error: "wrong_rota" });
});

// ---------------------------------------------------------------------------
test("12 · reflection is saved against its own rota and never escalates next week", () => {
  const products = [product("ret", "treatment", ["retinoid"]), product("cleanser", "cleanser")];
  const week1 = rotaFrom(products, "2026-10-05", "rota-1", { context: { retinoidExperience: "new" } });
  const reflected = recordReflection(week1, "calm", "refl-1", "2026-10-11T20:00:00.000Z");
  assert.equal(reflected.reflection?.feeling, "calm");
  assert.equal(recordReflection(reflected, "calm", "refl-1", "2026-10-11T21:00:00.000Z"), reflected);
  const history: RotaHistory = { rotas: [reflected], currentRotaId: reflected.id, appliedKeys: [] };
  const next = startNextWeek(history, {
    idempotencyKey: "n", now: "2026-10-12T05:00:00.000Z", newRotaId: "rota-2", startDate: "2026-10-12", products,
    build: { context: { retinoidExperience: "new" }, ruleSet: TEST_RULES, accepted: REVIEWED },
  });
  assert.equal(next.history.rotas.find((r) => r.id === "rota-1")?.reflection?.feeling, "calm");
  assert.equal(next.rota.reflection, null);
  assert.equal(daysWith(next.rota, "ret").length, daysWith(week1, "ret").length);
});

// ---------------------------------------------------------------------------
test("13 · merged records recompute streak from real completions only", () => {
  const week1 = rotaFrom([product("cleanser", "cleanser")]);
  const guest = weekRecords(week1, [0, 1, 2]);
  const target = weekRecords(week1, [0, 3]);
  // A mislabelled event (wrong date) cannot invent completion for the 4th day.
  const forged: DayRecord = {
    ...target[4],
    events: [{ id: "f", rotaId: week1.id, skincareDate: "2026-10-01", session: "am", occurredAt: "2026-10-09T08:00:00.000Z", timeZone: LAGOS, idempotencyKey: "f" }],
  };
  const merged = [...guest, ...target.slice(0, 4), forged];
  const s = computeStreak({ records: merged, rotas: [week1], now: "2026-10-09T20:00:00.000Z", timeZone: LAGOS });
  assert.deepEqual([s.continuity, s.earned, s.todayCounted], [4, 4, false]);
});

// ---------------------------------------------------------------------------
test("Friend Streak · Lagos + Dubai use each person's own 04:00 boundary, never UTC dates", () => {
  const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
  const mine = days.map((d) => done(record("me", d, LAGOS), `${d}T19:00:00.000Z`));
  // Friend in Dubai finished the 7th at 02:00 Dubai on the 8th (= 22:00Z on the 7th): still their 7th.
  const theirs = days.slice(0, 3).map((d, i) =>
    done(record("them", d, DUBAI), i === 2 ? "2026-10-07T22:00:00.000Z" : `${d}T15:00:00.000Z`),
  );
  theirs.push(record("them", "2026-10-08", DUBAI));
  // Now: 21:00 Lagos / 00:00 Dubai on the 9th (Dubai still on the 8th until 04:00).
  const now = "2026-10-08T20:00:00.000Z";
  const s1 = computeFriendStreak({ timeZone: LAGOS, records: mine }, { timeZone: DUBAI, records: theirs }, now);
  assert.deepEqual([s1.streak, s1.pairToday, s1.pairTodayCounted, s1.me, s1.friend], [3, "2026-10-08", false, "done", "not_yet"]);
  // Lagos user finishing at 03:00 local on the 9th (02:00Z, UTC date the 9th) still counts for the 8th.
  assert.equal(skincareDateAt("2026-10-09T02:00:00.000Z", LAGOS), "2026-10-08");
  theirs[3] = done(theirs[3], "2026-10-08T21:00:00.000Z");
  const s2 = computeFriendStreak({ timeZone: LAGOS, records: mine }, { timeZone: DUBAI, records: theirs }, now);
  assert.equal(s2.streak, 4);
  // Rescued days never count toward the pair, even though they keep a personal streak alive.
  const rescuedTheirs = theirs.map((r, i) => (i === 1 ? { ...record("them", r.skincareDate, DUBAI), rescue: { rescuedAt: now, idempotencyKey: "r" } } : r));
  const s3 = computeFriendStreak({ timeZone: LAGOS, records: mine }, { timeZone: DUBAI, records: rescuedTheirs }, now);
  assert.equal(s3.streak, 2);
});

test("One-product rota · empty days are Rest days completed by one check-in", () => {
  const rota = rotaFrom([product("ret", "treatment", ["retinoid"])]);
  const rest = rota.days.filter((d) => d.type === "rest");
  assert.equal(rest.length, 4);
  const r = record(rota.id, rest[0].skincareDate, LAGOS, { am: false, pm: false });
  const res = applyCompletion(r, {
    id: "x", rotaId: rota.id, skincareDate: r.skincareDate, session: "rest", occurredAt: `${r.skincareDate}T09:00:00.000Z`, timeZone: LAGOS, idempotencyKey: "x",
  });
  assert.ok(res.ok);
  if (res.ok) assert.equal(dayStatus(res.record, addDays(r.skincareDate, 1)), "rest_complete");
});

test("Swap to recovery is distinct from Rescue and never doubles", () => {
  const rota = rotaFrom([product("ret", "treatment", ["retinoid"]), product("cleanser", "cleanser")]);
  const idx = rota.days.findIndex((d) => d.type === "treatment");
  const swapped = applyRecoverySwap(rota, idx);
  assert.equal(swapped.days[idx].type, "recovery");
  assert.ok(!swapped.days[idx].pm.some((s) => s.activeClass));
  assert.deepEqual(swapped.days.filter((_, i) => i !== idx), rota.days.filter((_, i) => i !== idx));
  assert.equal(swapped.rescueUsedFor, null);
  assert.equal(applyRecoverySwap(swapped, idx), swapped);
});
