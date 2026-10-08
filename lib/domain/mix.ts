import { evidenceActiveClasses, isAnalysable, isHeldBySafetyFlag } from "./evidence";
import type {
  AcceptedStatuses,
  ActiveClass,
  CatalogueProduct,
  MixVerdict,
  PairRule,
  Reason,
  RuleSet,
  ShelfProduct,
} from "./types";
import { PRODUCTION_ACCEPTED } from "./types";

/**
 * Mix Check. A verdict only ever comes from a reviewed pair rule (or an
 * explicitly accepted status, e.g. demo fixtures in DEMO_MODE). Unknown,
 * partially read, corrected and unreviewed relationships ALWAYS return
 * `insufficient_evidence` — never compatible.
 */

export interface MixSubject {
  id: string;
  displayName: string;
  analysable: boolean;
  activeClasses: ActiveClass[];
  blockedBySafetyFlag: boolean;
}

export function shelfToMixSubject(product: ShelfProduct, accepted: AcceptedStatuses = PRODUCTION_ACCEPTED): MixSubject {
  return {
    id: product.id,
    displayName: product.name || "Unnamed product",
    analysable: isAnalysable(product),
    activeClasses: evidenceActiveClasses(product),
    blockedBySafetyFlag: isHeldBySafetyFlag(product, accepted),
  };
}

export function catalogueToMixSubject(product: CatalogueProduct): MixSubject {
  return {
    id: product.catalogueId,
    displayName: product.name,
    analysable: product.inciStatus === "verified" || product.inciStatus === "user_confirmed",
    activeClasses: evidenceActiveClasses(product),
    blockedBySafetyFlag: false,
  };
}

export function unknownMixSubject(id: string, name: string): MixSubject {
  return { id, displayName: name, analysable: false, activeClasses: [], blockedBySafetyFlag: false };
}

export type MixBasis = "reviewed_rule" | "unknown_product" | "unreviewed_pair" | "safety_flag" | "same_product";

export interface MixResult {
  verdict: MixVerdict;
  basis: MixBasis;
  /** Rules that produced the verdict (empty unless basis is reviewed_rule). */
  ruleIds: string[];
  ruleSetVersion: string;
  reasons: Reason[];
  /** Evidence-backed active classes, safe to show on a share card. Empty for unanalysable products. */
  activeClasses: [ActiveClass[], ActiveClass[]];
  unknownSubjectIds: string[];
}

const RESTRICTIVENESS: Record<Exclude<MixVerdict, "insufficient_evidence">, number> = {
  fine_together: 0,
  better_separated: 1,
  alternate_days: 2,
  professional_check: 3,
};

export function findPairRule(ruleSet: RuleSet, a: ActiveClass, b: ActiveClass, accepted: AcceptedStatuses) {
  return ruleSet.pairRules.find(
    (r) =>
      accepted.includes(r.status) &&
      (r.status !== "reviewed" || r.reviewers.length > 0) &&
      ((r.classA === a && r.classB === b) || (r.classA === b && r.classB === a)),
  );
}

export function evaluatePair(
  a: MixSubject,
  b: MixSubject,
  ruleSet: RuleSet,
  accepted: AcceptedStatuses = PRODUCTION_ACCEPTED,
): MixResult {
  const base = {
    ruleSetVersion: ruleSet.version,
    activeClasses: [a.analysable ? a.activeClasses : [], b.analysable ? b.activeClasses : []] as [ActiveClass[], ActiveClass[]],
  };
  if (a.id === b.id) {
    return {
      ...base,
      verdict: "insufficient_evidence",
      basis: "same_product",
      ruleIds: [],
      reasons: [{ heading: "Same product twice", body: "Pick two different products to compare." }],
      unknownSubjectIds: [],
    };
  }
  const flagged = [a, b].filter((s) => s.blockedBySafetyFlag);
  if (flagged.length) {
    return {
      ...base,
      verdict: "professional_check",
      basis: "safety_flag",
      ruleIds: [],
      reasons: [
        { heading: `A safety note on ${flagged[0].displayName}`, body: "See the note on that product before pairing it with anything." },
        { heading: "It stays out of your rota", body: "It can stay on your shelf. We won't schedule it." },
      ],
      unknownSubjectIds: [],
    };
  }
  const unknown = [a, b].filter((s) => !s.analysable);
  if (unknown.length) {
    const reasons: Reason[] =
      unknown.length === 2
        ? [{ heading: "We can't confirm either product", body: "We couldn't read or verify their ingredients, so we won't guess how they mix." }]
        : [
            { heading: `We can't confirm ${unknown[0].displayName}`, body: "We couldn't read or verify its ingredients, so we won't guess how it mixes with anything." },
            { heading: "Scan its back label", body: "If we can read the ingredient list, we can check the pair properly." },
          ];
    return { ...base, verdict: "insufficient_evidence", basis: "unknown_product", ruleIds: [], reasons, unknownSubjectIds: unknown.map((s) => s.id) };
  }
  const pairs: [ActiveClass, ActiveClass][] = [];
  for (const x of a.activeClasses) for (const y of b.activeClasses) pairs.push([x, y]);
  const rules: PairRule[] = [];
  for (const [x, y] of pairs) {
    const rule = findPairRule(ruleSet, x, y, accepted);
    if (!rule) {
      rules.length = 0;
      break;
    }
    rules.push(rule);
  }
  if (pairs.length === 0 || rules.length !== pairs.length) {
    return {
      ...base,
      verdict: "insufficient_evidence",
      basis: "unreviewed_pair",
      ruleIds: [],
      reasons: [{ heading: "We haven't reviewed this pair", body: "Until a reviewer has, we won't call it compatible." }],
      unknownSubjectIds: [],
    };
  }
  const decisive = rules.reduce((worst, r) => (RESTRICTIVENESS[r.verdict] > RESTRICTIVENESS[worst.verdict] ? r : worst));
  return {
    ...base,
    verdict: decisive.verdict,
    basis: "reviewed_rule",
    ruleIds: [...new Set(rules.map((r) => `${r.id}@${r.version}`))],
    reasons: decisive.reasons.slice(0, 3),
    unknownSubjectIds: [],
  };
}

export const VERDICT_LABEL: Record<MixVerdict, string> = {
  fine_together: "Fine together",
  better_separated: "Better separated",
  alternate_days: "Alternate days",
  professional_check: "Check with a professional",
  insufficient_evidence: "Not enough evidence",
};

export const VERDICT_LINE: Record<MixVerdict, string> = {
  fine_together: "A reviewed rule says these can share a routine.",
  better_separated: "A reviewed rule keeps these in different sessions.",
  alternate_days: "A reviewed rule puts these on different days.",
  professional_check: "One of these needs a pharmacist's view before it goes in a routine.",
  insufficient_evidence: "We can't confirm this pair, so we won't call it compatible.",
};

/** Lagoon for reviewed product intelligence; Sienna for professional/unknown. */
export function verdictTone(verdict: MixVerdict): "lagoon" | "sienna" {
  return verdict === "professional_check" || verdict === "insufficient_evidence" ? "sienna" : "lagoon";
}
