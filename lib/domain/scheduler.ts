import { evidenceActiveClasses, isAnalysable, isHeldBySafetyFlag } from "./evidence";
import { findPairRule, type MixResult } from "./mix";
import { addDays } from "./skincare-day";
import type {
  AcceptedStatuses,
  ActiveClass,
  DayType,
  HeldProduct,
  ISODateTime,
  IanaTimeZone,
  MixVerdict,
  PlanContext,
  ProductCategory,
  RotaDayPlan,
  RotaSnapshot,
  RotaStep,
  RuleSet,
  SessionKind,
  ShelfObservation,
  ShelfProduct,
  SkincareDate,
  TimingRule,
} from "./types";
import { PRODUCTION_ACCEPTED } from "./types";

/**
 * Deterministic seven-day scheduler.
 *
 * It contains NO clinical knowledge of its own. Timing, frequency, separation
 * and context holds all come from the RuleSet, filtered by accepted statuses.
 * When a rule is missing the product is held on the Shelf with
 * `insufficient_evidence`; it is never scheduled on a guess. Two actives
 * without an accepted pair rule never share a day. Routine ordering of gentle
 * basics (cleanse → treat → moisturise → sunscreen) is the only built-in
 * convention.
 */

export interface BuildRotaInput {
  rotaId: string;
  weekNumber: number;
  startDate: SkincareDate;
  timeZone: IanaTimeZone;
  createdAt: ISODateTime;
  products: ShelfProduct[];
  context: PlanContext;
  ruleSet: RuleSet;
  accepted?: AcceptedStatuses;
  previousRotaId?: string | null;
}

const STEP_ORDER: Record<string, number> = {
  cleanser: 0,
  toner: 1,
  vitamin_c: 2,
  niacinamide: 3,
  serum: 4,
  azelaic_acid: 5,
  benzoyl_peroxide: 5,
  aha: 6,
  bha: 6,
  retinoid: 7,
  treatment: 7,
  other: 8,
  unanalysed: 8,
  moisturiser: 9,
  sunscreen: 10,
};

function stepRank(step: RotaStep) {
  if (!step.analysed) return STEP_ORDER.unanalysed;
  if (step.activeClass) return STEP_ORDER[step.activeClass];
  return STEP_ORDER[step.category] ?? STEP_ORDER.other;
}

const BASIC_SESSIONS: Record<ProductCategory, SessionKind[]> = {
  cleanser: ["am", "pm"],
  toner: ["am", "pm"],
  serum: ["am", "pm"],
  treatment: ["pm"],
  moisturiser: ["am", "pm"],
  sunscreen: ["am"],
  other: ["am", "pm"],
};

interface ActivePlan {
  product: ShelfProduct;
  classes: ActiveClass[];
  sessions: SessionKind[];
  perWeek: number;
}

function acceptedRule<T extends { status: TimingRule["status"]; reviewers: unknown[] }>(rule: T | undefined, accepted: AcceptedStatuses) {
  return !!rule && accepted.includes(rule.status) && (rule.status !== "reviewed" || rule.reviewers.length > 0);
}

/** Ideal spread for n sessions over 7 days: n=2 → 0,3 · n=3 → 0,2,4 · n=4 → 0,1,3,5. */
export function spreadDays(n: number): number[] {
  const k = Math.max(0, Math.min(7, Math.floor(n)));
  return Array.from({ length: k }, (_, i) => Math.floor((i * 7) / k));
}

function pairVerdict(ruleSet: RuleSet, a: ActiveClass[], b: ActiveClass[], accepted: AcceptedStatuses): MixVerdict {
  let worst: MixVerdict = "fine_together";
  const rank: Record<MixVerdict, number> = {
    fine_together: 0,
    better_separated: 1,
    alternate_days: 2,
    professional_check: 3,
    insufficient_evidence: 4,
  };
  for (const x of a)
    for (const y of b) {
      const rule = findPairRule(ruleSet, x, y, accepted);
      const v: MixVerdict = rule ? rule.verdict : "insufficient_evidence";
      if (rank[v] > rank[worst]) worst = v;
    }
  return worst;
}

export function buildRota(input: BuildRotaInput): RotaSnapshot {
  const accepted = input.accepted ?? PRODUCTION_ACCEPTED;
  const { ruleSet, context } = input;
  const held: HeldProduct[] = [];
  const basics: { product: ShelfProduct; sessions: SessionKind[]; analysed: boolean }[] = [];
  const actives: ActivePlan[] = [];

  const holdClasses = new Set<ActiveClass>();
  if (context.care === "pregnant_or_breastfeeding" || context.care === "prescription_treatment") {
    for (const rule of ruleSet.contextHoldRules) {
      if (rule.context === context.care && acceptedRule(rule, accepted)) rule.holdClasses.forEach((c) => holdClasses.add(c));
    }
  }

  for (const product of input.products) {
    if (product.finishedAt) {
      held.push({ productId: product.id, reason: "finished" });
      continue;
    }
    if (isHeldBySafetyFlag(product, accepted)) {
      held.push({ productId: product.id, reason: "safety_flag" });
      continue;
    }
    if (!isAnalysable(product)) {
      const placement = product.placement ?? "none";
      if (placement === "none") held.push({ productId: product.id, reason: "not_analysable" });
      else basics.push({ product, sessions: [placement], analysed: false });
      continue;
    }
    const classes = evidenceActiveClasses(product);
    if (classes.length === 0) {
      basics.push({ product, sessions: BASIC_SESSIONS[product.category], analysed: true });
      continue;
    }
    if (classes.some((c) => holdClasses.has(c))) {
      held.push({ productId: product.id, reason: "context_hold" });
      continue;
    }
    const timing = classes.map((c) => ruleSet.timingRules.find((r) => r.activeClass === c && acceptedRule(r, accepted)));
    if (timing.some((t) => !t)) {
      held.push({ productId: product.id, reason: "insufficient_evidence" });
      continue;
    }
    const rules = timing as TimingRule[];
    const fixed = new Set(rules.map((r) => r.session).filter((s) => s !== "either"));
    if (fixed.size > 1) {
      held.push({ productId: product.id, reason: "insufficient_evidence" });
      continue;
    }
    const sessions: SessionKind[] = fixed.size === 1 ? [[...fixed][0] as SessionKind] : ["am", "pm"];
    const perWeek = Math.min(
      ...rules.map((r) =>
        r.activeClass === "retinoid" && context.retinoidExperience === "new" && r.maxPerWeekWhenNew != null
          ? r.maxPerWeekWhenNew
          : r.maxPerWeek,
      ),
    );
    actives.push({ product, classes, sessions, perWeek: Math.max(0, Math.min(7, perWeek)) });
  }

  // Scarcest first, then stable by id, so output is deterministic.
  actives.sort((a, b) => a.perWeek - b.perWeek || a.product.id.localeCompare(b.product.id));

  type Placed = { plan: ActivePlan; day: number; session: SessionKind };
  const placed: Placed[] = [];
  const canPlace = (plan: ActivePlan, day: number, session: SessionKind) => {
    for (const p of placed) {
      if (p.day !== day) continue;
      if (p.plan === plan) return false;
      const v = pairVerdict(ruleSet, plan.classes, p.plan.classes, accepted);
      if (p.session === session && v !== "fine_together") return false;
      if (p.session !== session && v !== "fine_together" && v !== "better_separated") return false;
    }
    return true;
  };

  for (const plan of actives) {
    let count = 0;
    const tried = new Set<number>();
    for (const ideal of spreadDays(plan.perWeek)) {
      for (let k = 0; k < 7 && count < plan.perWeek; k += 1) {
        const day = (ideal + k) % 7;
        if (tried.has(day)) continue;
        const session = plan.sessions.find((s) => canPlace(plan, day, s));
        if (session) {
          placed.push({ plan, day, session });
          tried.add(day);
          count += 1;
          break;
        }
      }
    }
    if (count === 0) held.push({ productId: plan.product.id, reason: "insufficient_evidence" });
  }

  const hasCapped = placed.some((p) => p.plan.perWeek < 7);
  const toStep = (product: ShelfProduct, analysed: boolean, activeClass: ActiveClass | null = null): RotaStep => ({
    productId: product.id,
    displayName: product.name || "Unnamed product",
    category: product.category,
    analysed,
    activeClass,
  });

  const days: RotaDayPlan[] = Array.from({ length: 7 }, (_, index) => {
    const am: RotaStep[] = [];
    const pm: RotaStep[] = [];
    for (const b of basics) {
      if (b.sessions.includes("am")) am.push(toStep(b.product, b.analysed));
      if (b.sessions.includes("pm")) pm.push(toStep(b.product, b.analysed));
    }
    let treatment = false;
    for (const p of placed.filter((x) => x.day === index)) {
      const step = toStep(p.plan.product, true, p.plan.classes[0]);
      (p.session === "am" ? am : pm).push(step);
      if (p.plan.perWeek < 7) treatment = true;
    }
    am.sort((a, b) => stepRank(a) - stepRank(b));
    pm.sort((a, b) => stepRank(a) - stepRank(b));
    const type: DayType = am.length + pm.length === 0 ? "rest" : treatment ? "treatment" : hasCapped ? "recovery" : "daily";
    return { index, skincareDate: addDays(input.startDate, index), type, am, pm };
  });

  const rota: RotaSnapshot = {
    id: input.rotaId,
    weekNumber: input.weekNumber,
    startDate: input.startDate,
    timeZone: input.timeZone,
    ruleSetVersion: ruleSet.version,
    productIds: input.products.filter((p) => !p.finishedAt).map((p) => p.id),
    days,
    held,
    shelfCheck: [],
    createdAt: input.createdAt,
    rescueUsedFor: null,
    archivedAt: null,
    reflection: null,
    previousRotaId: input.previousRotaId ?? null,
  };
  rota.shelfCheck = buildShelfCheck(rota, input.products);
  return rota;
}

// ---------------------------------------------------------------------------
// Plan facts
// ---------------------------------------------------------------------------

export function treatmentProductIds(rota: Pick<RotaSnapshot, "days">) {
  const ids = new Set<string>();
  for (const d of rota.days) for (const s of [...d.am, ...d.pm]) if (s.activeClass && d.type === "treatment") ids.add(s.productId);
  return [...ids];
}

export function daysWith(rota: Pick<RotaSnapshot, "days">, productId: string) {
  return rota.days.filter((d) => [...d.am, ...d.pm].some((s) => s.productId === productId)).map((d) => d.index);
}

export function countDayTypes(rota: Pick<RotaSnapshot, "days">) {
  const out: Record<DayType, number> = { treatment: 0, recovery: 0, daily: 0, rest: 0 };
  for (const d of rota.days) out[d.type] += 1;
  return out;
}

/**
 * Shelf Check: at most three observations. Each is a FACT about this plan or
 * about what we could not analyse — never a score and never new advice.
 */
export function buildShelfCheck(rota: RotaSnapshot, products: ShelfProduct[]): ShelfObservation[] {
  const name = (id: string) => products.find((p) => p.id === id)?.name || "A product";
  const out: ShelfObservation[] = [];
  const safety = rota.held.filter((h) => h.reason === "safety_flag");
  if (safety.length) out.push({ id: "safety", tone: "unknown", text: `${name(safety[0].productId)} has a safety note, so it stays on your shelf and out of this rota.` });
  const ctx = rota.held.filter((h) => h.reason === "context_hold");
  if (ctx.length) out.push({ id: "context", tone: "unknown", text: `${name(ctx[0].productId)} is held this week because of your answers. Check with a professional first.` });
  const treat = treatmentProductIds(rota);
  if (treat.length >= 2) {
    const [a, b] = treat;
    const shared = daysWith(rota, a).some((d) => daysWith(rota, b).includes(d));
    out.push({ id: "separation", tone: "insight", text: shared ? `${name(a)} and ${name(b)} share some days, in different sessions.` : `${name(a)} and ${name(b)} are on different days.` });
  } else if (treat.length === 1) {
    const n = daysWith(rota, treat[0]).length;
    out.push({ id: "frequency", tone: "insight", text: `${name(treat[0])} is on ${n} ${n === 1 ? "day" : "days"} this week, with lighter days between.` });
  }
  const unreviewed = rota.held.filter((h) => h.reason === "insufficient_evidence");
  if (unreviewed.length) out.push({ id: "unreviewed", tone: "unknown", text: `${name(unreviewed[0].productId)} is waiting for a reviewed rule, so it's on your shelf but not scheduled.` });
  const unanalysed = products.filter((p) => !p.finishedAt && !isAnalysable(p));
  if (unanalysed.length) out.push({ id: "unknown", tone: "unknown", text: `${name(unanalysed[0].id)} isn't analysed, so it's left out of these checks.` });
  const sunscreenInAm = rota.days.every((d) => d.am.length === 0 || d.am.some((s) => s.category === "sunscreen" && s.analysed));
  if (rota.days.some((d) => d.am.length)) {
    out.push(
      sunscreenInAm && rota.days.some((d) => d.am.some((s) => s.category === "sunscreen"))
        ? { id: "sunscreen", tone: "insight", text: "Sunscreen is the last step every morning." }
        : { id: "sunscreen", tone: "insight", text: "No sunscreen on your shelf yet. Mornings end with your last step." },
    );
  }
  return out.slice(0, 3);
}

/** Swap tonight to recovery: removes tonight's actives only. Nothing moves, nothing doubles. */
export function applyRecoverySwap(rota: RotaSnapshot, dayIndex: number): RotaSnapshot {
  const day = rota.days[dayIndex];
  if (!day || day.type !== "treatment" || !day.pm.some((s) => s.activeClass)) return rota;
  const days = rota.days.map((d) =>
    d.index === dayIndex ? { ...d, pm: d.pm.filter((s) => !s.activeClass), type: "recovery" as const, swappedToRecovery: true } : d,
  );
  return { ...rota, days };
}

export function canSwapToRecovery(rota: RotaSnapshot, dayIndex: number) {
  const day = rota.days[dayIndex];
  return !!day && day.type === "treatment" && !day.swappedToRecovery && day.pm.some((s) => s.activeClass);
}

/**
 * The Reveal note after Mix Check. Derived from BOTH the actual verdict and the
 * actual plan, so it can never claim a separation the rota does not have.
 */
export function mixNoteForRota(
  rota: RotaSnapshot,
  mix: Pick<MixResult, "verdict">,
  a: { id: string; name: string },
  b: { id: string; name: string },
): string {
  const daysA = daysWith(rota, a.id);
  const daysB = daysWith(rota, b.id);
  const heldA = rota.held.find((h) => h.productId === a.id);
  const heldB = rota.held.find((h) => h.productId === b.id);
  if (mix.verdict === "professional_check" || heldA?.reason === "safety_flag" || heldB?.reason === "safety_flag") {
    const flagged = heldA?.reason === "safety_flag" ? a : heldB?.reason === "safety_flag" ? b : heldA ? a : b;
    return `From Mix Check: ${flagged.name} needs a professional's view first, so it stays on your shelf and out of this rota.`;
  }
  if (!daysA.length || !daysB.length) {
    const missing = !daysA.length ? a : b;
    return `From Mix Check: ${missing.name} isn't in this rota yet, so the two never meet.`;
  }
  const sameDay = daysA.some((d) => daysB.includes(d));
  const sameSession = rota.days.some((d) =>
    (["am", "pm"] as const).some((k) => d[k].some((s) => s.productId === a.id) && d[k].some((s) => s.productId === b.id)),
  );
  switch (mix.verdict) {
    case "alternate_days":
      return sameDay
        ? `From Mix Check: ${a.name} and ${b.name} should be on different days, but this rota has them together. Please rebuild.`
        : `From Mix Check: ${a.name} and ${b.name} never share a day in this rota.`;
    case "better_separated":
      return sameSession
        ? `From Mix Check: ${a.name} and ${b.name} should be in different sessions, but this rota pairs them. Please rebuild.`
        : `From Mix Check: ${a.name} and ${b.name} stay in different sessions in this rota.`;
    case "fine_together":
      return sameSession
        ? `From Mix Check: ${a.name} and ${b.name} are fine together, so they can share a session.`
        : `From Mix Check: ${a.name} and ${b.name} are fine together. This rota still follows your usual order.`;
    default: {
      if (!sameSession) {
        return `From Mix Check: we couldn't confirm how ${a.name} and ${b.name} mix, so this rota never puts them in the same session.`;
      }
      const unanalysed = rota.days.some((d) =>
        [...d.am, ...d.pm].some((s) => (s.productId === a.id || s.productId === b.id) && !s.analysed),
      );
      return unanalysed
        ? `From Mix Check: we couldn't confirm how ${a.name} and ${b.name} mix. They share a session only because you placed one there; we haven't analysed it.`
        : `From Mix Check: there's no reviewed rule for ${a.name} and ${b.name}. They sit in the same session as part of your basic routine order, not because we checked the pair.`;
    }
  }
}
