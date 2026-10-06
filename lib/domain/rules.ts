import type {
  ActiveClass,
  Relationship,
  RelationshipReason,
  Rule,
} from "./types";

export const DRAFT_RULES: Rule[] = [
  {
    id: "retinoid-aha-alternate",
    classA: "retinoid",
    classB: "aha",
    relationship: "alternate",
    reason: "irritation",
    explanation: "Use them on different nights in this rota.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "retinoid-bha-alternate",
    classA: "retinoid",
    classB: "bha",
    relationship: "alternate",
    reason: "irritation",
    explanation: "Use them on different nights in this rota.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "aha-bha-caution",
    classA: "aha",
    classB: "bha",
    relationship: "caution",
    reason: "irritation",
    explanation: "Avoid stacking both exfoliating steps in the same session.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "laa-aha-caution",
    classA: "vitamin_c_laa",
    classB: "aha",
    relationship: "caution",
    reason: "irritation",
    explanation: "The rota separates these when possible to keep the routine simpler.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "laa-bha-caution",
    classA: "vitamin_c_laa",
    classB: "bha",
    relationship: "caution",
    reason: "irritation",
    explanation: "The rota separates these when possible to keep the routine simpler.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "niacinamide-retinoid-compatible",
    classA: "niacinamide",
    classB: "retinoid",
    relationship: "compatible",
    reason: "unknown",
    explanation: "No separation rule is applied in the rota.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "niacinamide-laa-compatible",
    classA: "niacinamide",
    classB: "vitamin_c_laa",
    relationship: "compatible",
    reason: "unknown",
    explanation: "No separation rule is applied in the rota.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
  {
    id: "azelaic-niacinamide-compatible",
    classA: "azelaic_acid",
    classB: "niacinamide",
    relationship: "compatible",
    reason: "unknown",
    explanation: "No separation rule is applied in the rota.",
    sourceRefs: [],
    reviewedBy: [],
    status: "draft",
  },
];

export interface RelationshipResult {
  relationship: Relationship;
  reason: RelationshipReason;
  explanation: string;
}

export function getRelationship(
  classA: ActiveClass,
  classB: ActiveClass,
): RelationshipResult {
  if (classA === classB) {
    return {
      relationship: "caution",
      reason: "duplication",
      explanation: "These do the same job. Use one in a session rather than stacking both.",
    };
  }

  const rule = DRAFT_RULES.find(
    (item) =>
      (item.classA === classA && item.classB === classB) ||
      (item.classA === classB && item.classB === classA),
  );

  if (!rule) {
    return {
      relationship: "insufficient_evidence",
      reason: "unknown",
      explanation: "No scheduling rule is defined for this pair yet.",
    };
  }

  return {
    relationship: rule.relationship,
    reason: rule.reason,
    explanation: rule.explanation,
  };
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  compatible: "Fine together",
  caution: "Better separated",
  alternate: "Alternate days",
  avoid: "Check with a professional",
  insufficient_evidence: "Not enough evidence",
};
