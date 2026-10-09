import type { RuleSet, PairRule, TimingRule, ContextHoldRule } from "@/lib/domain/types";

/**
 * DRAFT clinical rule foundation — PREPARED FOR REVIEW, NOT APPROVED.
 *
 * Every rule here is status "draft" with reviewers: []. The production path
 * (lib/server/rota-store.ts NO_CLINICAL_RULES + PRODUCTION_ACCEPTED = ["reviewed"])
 * does NOT import this set, and the domain engine ignores any rule whose status a
 * caller does not accept — so these never produce a production verdict. They exist
 * so a pharmacist/dermatologist can review the evidenceRefs and, only then, set
 * status "reviewed" + add reviewer attribution.
 *
 * Until that review happens, Mix returns `insufficient_evidence` and the scheduler
 * holds actives rather than guessing. An OCR reading, a catalogue listing or a user
 * correction NEVER becomes reviewed evidence.
 *
 * Sources below are starting references for the reviewer, not a clinical endorsement.
 */

const DRAFT = { status: "draft" as const, reviewers: [] };

const pairRules: PairRule[] = [
  {
    id: "PAIR-RET-AHA", version: "0.1-draft", classA: "retinoid", classB: "aha",
    verdict: "alternate_days",
    reasons: [{ heading: "Alternate nights", body: "Combined nightly use commonly raises irritation; alternating reduces overlap while keeping both in the routine." }],
    evidenceRefs: [
      "https://www.aad.org/public/everyday-care/skin-care-basics/care/retinoid-retinol",
      "REVIEW-NEEDED: confirm wording, strength thresholds and exceptions",
    ],
    ...DRAFT,
  },
  {
    id: "PAIR-RET-BHA", version: "0.1-draft", classA: "retinoid", classB: "bha",
    verdict: "alternate_days",
    reasons: [{ heading: "Alternate nights", body: "Retinoid plus a BHA exfoliant in the same session can over-exfoliate; separate them." }],
    evidenceRefs: ["REVIEW-NEEDED: dermatology reviewer to confirm and cite"],
    ...DRAFT,
  },
  {
    id: "PAIR-BPO-RET", version: "0.1-draft", classA: "benzoyl_peroxide", classB: "retinoid",
    verdict: "better_separated",
    reasons: [{ heading: "Use at different times", body: "Benzoyl peroxide can oxidise some retinoids; many guidelines suggest AM/PM separation." }],
    evidenceRefs: ["REVIEW-NEEDED: confirm which retinoids are affected (adapalene is stable)"],
    ...DRAFT,
  },
  {
    id: "PAIR-VITC-NIA", version: "0.1-draft", classA: "vitamin_c", classB: "niacinamide",
    verdict: "fine_together",
    reasons: [{ heading: "Fine together", body: "Modern formulations are routinely combined; the historical incompatibility claim is largely outdated." }],
    evidenceRefs: ["REVIEW-NEEDED: cite current formulation literature"],
    ...DRAFT,
  },
];

const timingRules: TimingRule[] = [
  {
    id: "TIME-RET", version: "0.1-draft", activeClass: "retinoid", session: "pm",
    maxPerWeek: 7, maxPerWeekWhenNew: 2,
    evidenceRefs: ["REVIEW-NEEDED: confirm starting frequency for new users and titration"],
    ...DRAFT,
  },
  {
    id: "TIME-AHA", version: "0.1-draft", activeClass: "aha", session: "pm", maxPerWeek: 3,
    evidenceRefs: ["REVIEW-NEEDED: confirm weekly exfoliation ceiling"],
    ...DRAFT,
  },
  {
    id: "TIME-BHA", version: "0.1-draft", activeClass: "bha", session: "pm", maxPerWeek: 3,
    evidenceRefs: ["REVIEW-NEEDED"],
    ...DRAFT,
  },
];

const contextHoldRules: ContextHoldRule[] = [
  {
    id: "HOLD-PREG", version: "0.1-draft", context: "pregnant_or_breastfeeding",
    holdClasses: ["retinoid"],
    evidenceRefs: ["REVIEW-NEEDED: confirm which actives to hold during pregnancy/breastfeeding"],
    ...DRAFT,
  },
  {
    id: "HOLD-RX", version: "0.1-draft", context: "prescription_treatment",
    holdClasses: ["retinoid", "benzoyl_peroxide"],
    evidenceRefs: ["REVIEW-NEEDED: defer to the user's prescriber"],
    ...DRAFT,
  },
];

/** NOT wired into production. For pharmacist/dermatologist review only. */
export const DRAFT_RULESET: RuleSet = {
  version: "draft-2026-10",
  pairRules,
  timingRules,
  contextHoldRules,
};
