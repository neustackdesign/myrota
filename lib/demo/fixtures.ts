/**
 * DEMO_MODE fixtures — illustrative only.
 *
 * Every rule here has status "demo_fixture" and NO reviewer, so production code
 * (which accepts "reviewed" only) ignores all of it. Product names are
 * fictional ("Demo Lab"); ingredient lists are minimal stand-ins, not real
 * formulations. Safety copy is placeholder pending pharmacist review. None of
 * this is skincare advice.
 */
import type {
  CatalogueProduct,
  InciIngredient,
  RuleSet,
  SafetyFlag,
} from "../domain/types";

export const DEMO_RULES: RuleSet = {
  version: "demo-fixture-0",
  pairRules: [
    {
      id: "DEMO-RET-BHA", version: "0", classA: "retinoid", classB: "bha", verdict: "alternate_days", status: "demo_fixture", reviewers: [], evidenceRefs: [],
      reasons: [
        { heading: "Give them separate days", body: "Placeholder copy pending review." },
        { heading: "Lighter days between", body: "Placeholder copy pending review." },
      ],
    },
    {
      id: "DEMO-RET-VITC", version: "0", classA: "retinoid", classB: "vitamin_c", verdict: "better_separated", status: "demo_fixture", reviewers: [], evidenceRefs: [],
      reasons: [{ heading: "Morning and evening", body: "Placeholder copy pending review." }],
    },
    {
      id: "DEMO-BHA-VITC", version: "0", classA: "bha", classB: "vitamin_c", verdict: "better_separated", status: "demo_fixture", reviewers: [], evidenceRefs: [],
      reasons: [{ heading: "Split by time of day", body: "Placeholder copy pending review." }],
    },
    {
      id: "DEMO-NIAC-VITC", version: "0", classA: "niacinamide", classB: "vitamin_c", verdict: "fine_together", status: "demo_fixture", reviewers: [], evidenceRefs: [],
      reasons: [{ heading: "They can share a session", body: "Placeholder copy pending review." }],
    },
  ],
  timingRules: [
    { id: "DEMO-T-RET", version: "0", activeClass: "retinoid", session: "pm", maxPerWeek: 3, maxPerWeekWhenNew: 2, status: "demo_fixture", reviewers: [], evidenceRefs: [] },
    { id: "DEMO-T-BHA", version: "0", activeClass: "bha", session: "pm", maxPerWeek: 2, status: "demo_fixture", reviewers: [], evidenceRefs: [] },
    { id: "DEMO-T-VITC", version: "0", activeClass: "vitamin_c", session: "am", maxPerWeek: 7, status: "demo_fixture", reviewers: [], evidenceRefs: [] },
    { id: "DEMO-T-NIAC", version: "0", activeClass: "niacinamide", session: "either", maxPerWeek: 7, status: "demo_fixture", reviewers: [], evidenceRefs: [] },
  ],
  contextHoldRules: [
    { id: "DEMO-H-PREG", version: "0", context: "pregnant_or_breastfeeding", holdClasses: ["retinoid"], status: "demo_fixture", reviewers: [], evidenceRefs: [] },
    { id: "DEMO-H-RX", version: "0", context: "prescription_treatment", holdClasses: ["retinoid", "bha"], status: "demo_fixture", reviewers: [], evidenceRefs: [] },
  ],
};

let n = 0;
const ing = (text: string, activeClass: InciIngredient["activeClass"] = null): InciIngredient => ({
  id: `demo-ing-${(n += 1)}`,
  text,
  normalized: text.toUpperCase(),
  status: "verified",
  activeClass,
});

const cat = (
  catalogueId: string,
  name: string,
  category: CatalogueProduct["category"],
  format: CatalogueProduct["format"],
  ingredients: InciIngredient[],
): CatalogueProduct => ({
  catalogueId,
  brand: "Demo Lab",
  name,
  category,
  format,
  identityKey: `demo:${catalogueId}`,
  variant: "standard",
  ingredients,
  inciStatus: "verified",
});

export const DEMO_CATALOGUE: CatalogueProduct[] = [
  cat("cleanser", "Gentle Cream Cleanser", "cleanser", "rinse_off", [ing("Aqua"), ing("Glycerin"), ing("Cetearyl Alcohol")]),
  cat("toner", "Hydrating Toner", "toner", "leave_on", [ing("Aqua"), ing("Glycerin"), ing("Panthenol")]),
  cat("vitc", "Vitamin C Serum", "serum", "leave_on", [ing("Aqua"), ing("Ascorbic Acid", "vitamin_c"), ing("Ferulic Acid")]),
  cat("niac", "Niacinamide Serum", "serum", "leave_on", [ing("Aqua"), ing("Niacinamide", "niacinamide"), ing("Zinc PCA")]),
  cat("ret", "Retinal Night Serum", "treatment", "leave_on", [ing("Aqua"), ing("Squalane"), ing("Retinal", "retinoid")]),
  cat("bha", "BHA Liquid Exfoliant", "treatment", "leave_on", [ing("Aqua"), ing("Salicylic Acid", "bha"), ing("Butylene Glycol")]),
  cat("moist", "Barrier Moisturiser", "moisturiser", "leave_on", [ing("Aqua"), ing("Glycerin"), ing("Ceramide NP")]),
  cat("spf", "Daily Sunscreen SPF 50", "sunscreen", "leave_on", [ing("Aqua"), ing("Homosalate"), ing("Glycerin")]),
];

export const DEMO_LABEL_FLAG: SafetyFlag = {
  id: "demo-flag-hq",
  kind: "label_declared",
  ruleId: "HQ-01",
  ruleVersion: "draft",
  status: "demo_fixture",
  title: "The label lists hydroquinone",
  body: "Hydroquinone is a prescription medicine in many countries. We've kept this product out of your rota. A pharmacist can tell you whether it's right for you.",
  reviewers: [],
  evidenceRefs: [],
};

export const DEMO_ALERT_FLAG: SafetyFlag = {
  id: "demo-flag-alert",
  kind: "regulatory_alert",
  ruleId: "ALERT-FEED",
  ruleVersion: "draft",
  status: "demo_fixture",
  title: "This product appears in a regulator alert",
  body: "An official notice named this exact product and size. It describes tested samples, not your bottle. We've kept it out of your rota.",
  reviewers: [],
  evidenceRefs: [],
  notice: {
    regulator: "[Regulator name — placeholder]",
    reference: "[Notice ref — placeholder]",
    url: "https://example.org/demo-regulator-notice",
    publishedAt: "2026-09-01T00:00:00.000Z",
    productIdentityKey: "demo:bright-glow-200",
    variant: "200ml",
  },
};

export const DEMO_FRIEND = { name: "Ama", initials: "A" };
export const DEMO_JOINER = { name: "Tobi", initials: "T" };
export const DEMO_INVITE_TOKEN = "demo-a8Kb4Q";
