/**
 * TEST-ONLY fixtures. The reviewer below is a placeholder that lets tests
 * exercise the "reviewed" code path; it is not a real review and these rules
 * are not skincare advice. Nothing here is imported by app code.
 */
import type {
  ActiveClass,
  CompletionEvent,
  DayRecord,
  InciIngredient,
  ProductCategory,
  Reviewer,
  RuleSet,
  ShelfProduct,
} from "../../lib/domain/types";

export const TEST_REVIEWER: Reviewer = { name: "TEST FIXTURE — not a real review", role: "pharmacist", reviewedAt: "2026-10-01T00:00:00.000Z" };

export const TEST_RULES: RuleSet = {
  version: "test-1",
  pairRules: [
    { id: "T-RET-BHA", version: "1", classA: "retinoid", classB: "bha", verdict: "alternate_days", reasons: [{ heading: "Different days", body: "Test fixture." }], status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-RET-VITC", version: "1", classA: "retinoid", classB: "vitamin_c", verdict: "better_separated", reasons: [{ heading: "Different sessions", body: "Test fixture." }], status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-BHA-VITC", version: "1", classA: "bha", classB: "vitamin_c", verdict: "better_separated", reasons: [{ heading: "Different sessions", body: "Test fixture." }], status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-NIAC-VITC", version: "1", classA: "niacinamide", classB: "vitamin_c", verdict: "fine_together", reasons: [{ heading: "Can share", body: "Test fixture." }], status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-DRAFT", version: "1", classA: "aha", classB: "niacinamide", verdict: "fine_together", reasons: [], status: "draft", reviewers: [], evidenceRefs: [] },
  ],
  timingRules: [
    { id: "T-TIME-RET", version: "1", activeClass: "retinoid", session: "pm", maxPerWeek: 3, maxPerWeekWhenNew: 2, status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-TIME-BHA", version: "1", activeClass: "bha", session: "pm", maxPerWeek: 2, status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-TIME-VITC", version: "1", activeClass: "vitamin_c", session: "am", maxPerWeek: 7, status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-TIME-NIAC", version: "1", activeClass: "niacinamide", session: "either", maxPerWeek: 7, status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
    { id: "T-TIME-AZA", version: "1", activeClass: "azelaic_acid", session: "pm", maxPerWeek: 3, status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
  ],
  contextHoldRules: [
    { id: "T-HOLD-PREG", version: "1", context: "pregnant_or_breastfeeding", holdClasses: ["retinoid"], status: "reviewed", reviewers: [TEST_REVIEWER], evidenceRefs: ["test"] },
  ],
};

let seq = 0;
const ing = (text: string, activeClass: ActiveClass | null = null, status: InciIngredient["status"] = "verified"): InciIngredient => ({
  id: `i${(seq += 1)}`,
  text,
  normalized: text.toUpperCase(),
  status,
  activeClass,
});

export function product(
  id: string,
  category: ProductCategory,
  actives: ActiveClass[] = [],
  over: Partial<ShelfProduct> = {},
): ShelfProduct {
  return {
    id,
    brand: "Brand",
    name: id,
    category,
    format: "leave_on",
    identityStatus: "verified",
    inciStatus: "verified",
    identityKey: `sku:${id}`,
    variant: "30ml",
    ingredients: [ing("Aqua"), ing("Glycerin"), ...actives.map((a) => ing(a, a))],
    flags: [],
    source: "search",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

export function record(rotaId: string, date: string, tz: string, sessions: { am?: boolean; pm?: boolean } = { am: true, pm: true }): DayRecord {
  return { rotaId, skincareDate: date, timeZone: tz, scheduled: { am: !!sessions.am, pm: !!sessions.pm }, events: [] };
}

export function done(r: DayRecord, at: string, sessions: CompletionEvent["session"][] = ["am", "pm"]): DayRecord {
  return {
    ...r,
    events: [
      ...r.events,
      ...sessions.map((s) => ({
        id: `${r.skincareDate}-${s}`,
        rotaId: r.rotaId,
        skincareDate: r.skincareDate,
        session: s,
        occurredAt: at,
        timeZone: r.timeZone,
        idempotencyKey: `${r.rotaId}-${r.skincareDate}-${s}`,
      })),
    ],
  };
}
