/**
 * myrota pure domain contract.
 *
 * Platform-neutral: no React, no DOM, no storage, no network. Shared by the
 * Next.js UI, the HTTP adapter and (later) Expo. Shapes mirror the typed HTTP
 * surfaces in docs/IMPLEMENTATION_HANDOFF.md.
 *
 * Nothing in this folder is clinical truth. Clinical/therapeutic behaviour only
 * comes from a versioned RuleSet whose rules carry reviewer attribution; any
 * rule whose status is not accepted by the caller is ignored and the outcome
 * degrades to `insufficient_evidence`.
 */

/** ISO 8601 instant, e.g. 2026-10-08T19:42:00.000Z */
export type ISODateTime = string;
/** User skincare date: plain YYYY-MM-DD computed in the user's IANA zone with the 04:00 rollover. Never a UTC date. */
export type SkincareDate = string;
/** IANA time zone ID, e.g. Africa/Lagos, Asia/Dubai. */
export type IanaTimeZone = string;

// ---------------------------------------------------------------------------
// Product evidence
// ---------------------------------------------------------------------------

/** Evidence dimension, NOT a safety guarantee. Identity and INCI each carry one independently. */
export type EvidenceStatus = "verified" | "user_confirmed" | "partial" | "unknown" | "corrected";
/** Alias used by the handoff contract. */
export type ProductConfidence = EvidenceStatus;

export type ProductCategory =
  | "cleanser"
  | "toner"
  | "serum"
  | "treatment"
  | "moisturiser"
  | "sunscreen"
  | "other";

export type ProductFormat = "rinse_off" | "leave_on" | "unknown";

/** Evidence-backed active classes. Only ever derived from verified or user-confirmed INCI. */
export type ActiveClass =
  | "retinoid"
  | "aha"
  | "bha"
  | "vitamin_c"
  | "niacinamide"
  | "azelaic_acid"
  | "benzoyl_peroxide";

export type SessionKind = "am" | "pm";
/** Where the user chose to place a product we cannot analyse. */
export type UserPlacement = "am" | "pm" | "none";

export type IngredientStatus = "read" | "verified" | "unreadable" | "corrected";

export interface InciIngredient {
  id: string;
  /** Text as read or typed. Empty for an unreadable line. */
  text: string;
  /** Deterministic normalised INCI name (CosIng is name-normalisation only, never safety). */
  normalized?: string | null;
  status: IngredientStatus;
  /** Present only when the ingredient was read/verified, never on a user correction. */
  activeClass?: ActiveClass | null;
  /** The label declares an ingredient covered by a SafetyFlag rule. */
  flagged?: boolean;
}

export interface Reviewer {
  name: string;
  role: "pharmacist" | "dermatologist";
  reviewedAt: ISODateTime;
}

/** Review state of a rule. `demo_fixture` is only ever accepted by the explicit DEMO_MODE repository. */
export type RuleStatus = "reviewed" | "draft" | "demo_fixture";

export interface RegulatoryNotice {
  regulator: string;
  reference: string;
  /** Exact authoritative notice URL. Required for the alert to render. */
  url: string;
  publishedAt: ISODateTime;
  /** Verified canonical SKU the notice names. */
  productIdentityKey: string;
  /** Variant the notice names (size/shade/batch descriptor). */
  variant: string;
}

export interface SafetyFlag {
  id: string;
  /**
   * label_declared: the label itself lists an ingredient a reviewed rule covers.
   * regulatory_alert: an independently documented regulator notice names this exact verified product + variant.
   */
  kind: "label_declared" | "regulatory_alert";
  ruleId: string;
  ruleVersion: string;
  status: RuleStatus;
  title: string;
  body: string;
  reviewers: Reviewer[];
  evidenceRefs: string[];
  notice?: RegulatoryNotice | null;
}

export type ProductSource = "scan" | "gallery" | "paste" | "search" | "manual";

export interface ShelfProduct {
  id: string;
  brand: string;
  name: string;
  category: ProductCategory;
  format: ProductFormat;
  identityStatus: EvidenceStatus;
  inciStatus: EvidenceStatus;
  /** Verified canonical SKU (incl. variant) or stable user-confirmed signature. Null when unknown. */
  identityKey?: string | null;
  variant?: string | null;
  ingredients: InciIngredient[];
  flags: SafetyFlag[];
  /** User-chosen timing for products we cannot analyse. */
  placement?: UserPlacement;
  source: ProductSource;
  finishedAt?: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A library/catalogue match returned by search. Not on anyone's shelf yet. */
export interface CatalogueProduct {
  catalogueId: string;
  brand: string;
  name: string;
  category: ProductCategory;
  format: ProductFormat;
  identityKey: string;
  variant?: string | null;
  ingredients: InciIngredient[];
  inciStatus: EvidenceStatus;
}

// ---------------------------------------------------------------------------
// Rules (versioned, reviewer-attributed)
// ---------------------------------------------------------------------------

export type MixVerdict =
  | "fine_together"
  | "better_separated"
  | "alternate_days"
  | "professional_check"
  | "insufficient_evidence";

export interface Reason {
  heading: string;
  body: string;
}

export interface PairRule {
  id: string;
  version: string;
  classA: ActiveClass;
  classB: ActiveClass;
  verdict: Exclude<MixVerdict, "insufficient_evidence">;
  reasons: Reason[];
  status: RuleStatus;
  reviewers: Reviewer[];
  evidenceRefs: string[];
}

export interface TimingRule {
  id: string;
  version: string;
  activeClass: ActiveClass;
  session: SessionKind | "either";
  /** Maximum scheduled sessions per seven-day rota. */
  maxPerWeek: number;
  /** Optional tighter bound for users new to this class (e.g. RET-START). */
  maxPerWeekWhenNew?: number;
  status: RuleStatus;
  reviewers: Reviewer[];
  evidenceRefs: string[];
}

export type CareContext = "pregnant_or_breastfeeding" | "prescription_treatment";

export interface ContextHoldRule {
  id: string;
  version: string;
  context: CareContext;
  holdClasses: ActiveClass[];
  status: RuleStatus;
  reviewers: Reviewer[];
  evidenceRefs: string[];
}

export interface RuleSet {
  version: string;
  pairRules: PairRule[];
  timingRules: TimingRule[];
  contextHoldRules: ContextHoldRule[];
}

/** Which rule statuses a caller trusts. Production: ["reviewed"] only. */
export type AcceptedStatuses = readonly RuleStatus[];
export const PRODUCTION_ACCEPTED: AcceptedStatuses = ["reviewed"];

// ---------------------------------------------------------------------------
// Context (private, device-local; never shared, never merged)
// ---------------------------------------------------------------------------

export type RetinoidExperience = "new" | "some" | "long";
export type CareAnswer = CareContext | "none" | "prefer_not_to_say";

export interface PlanContext {
  retinoidExperience?: RetinoidExperience | null;
  care?: CareAnswer | null;
}

// ---------------------------------------------------------------------------
// Rota
// ---------------------------------------------------------------------------

export type DayType = "treatment" | "recovery" | "daily" | "rest";

export interface RotaStep {
  productId: string;
  displayName: string;
  category: ProductCategory;
  /** False for unknown/partial/corrected products placed by the user: never paired or checked. */
  analysed: boolean;
  activeClass?: ActiveClass | null;
}

export interface RotaDayPlan {
  index: number;
  skincareDate: SkincareDate;
  type: DayType;
  am: RotaStep[];
  pm: RotaStep[];
  /** User elected Swap to recovery for this night. Distinct from Rescue. */
  swappedToRecovery?: boolean;
}

export interface ShelfObservation {
  id: string;
  text: string;
  /** Lagoon (reviewed fact about the plan) vs Sienna (we don't know). */
  tone: "insight" | "unknown";
}

export interface HeldProduct {
  productId: string;
  reason: "safety_flag" | "context_hold" | "insufficient_evidence" | "not_analysable" | "finished";
}

export type Feeling = "calm" | "bit_irritated" | "very_irritated";

export interface Reflection {
  feeling: Feeling;
  recordedAt: ISODateTime;
  idempotencyKey: string;
}

export interface RotaSnapshot {
  id: string;
  weekNumber: number;
  startDate: SkincareDate;
  timeZone: IanaTimeZone;
  ruleSetVersion: string;
  productIds: string[];
  days: RotaDayPlan[];
  held: HeldProduct[];
  shelfCheck: ShelfObservation[];
  createdAt: ISODateTime;
  /** The single Rescue of THIS rota, if spent. */
  rescueUsedFor?: SkincareDate | null;
  archivedAt?: ISODateTime | null;
  reflection?: Reflection | null;
  previousRotaId?: string | null;
}

// ---------------------------------------------------------------------------
// Day records (immutable, idempotent; keyed by rotaId + skincareDate)
// ---------------------------------------------------------------------------

export type CompletionSession = SessionKind | "rest";

export interface CompletionEvent {
  id: string;
  rotaId: string;
  skincareDate: SkincareDate;
  session: CompletionSession;
  occurredAt: ISODateTime;
  timeZone: IanaTimeZone;
  idempotencyKey: string;
}

export interface DayRecord {
  rotaId: string;
  skincareDate: SkincareDate;
  timeZone: IanaTimeZone;
  scheduled: { am: boolean; pm: boolean };
  events: CompletionEvent[];
  rescue?: { rescuedAt: ISODateTime; idempotencyKey: string } | null;
  rescueDeclinedAt?: ISODateTime | null;
  swappedToRecoveryAt?: ISODateTime | null;
}

export type DayStatus = "future" | "in_progress" | "complete" | "missed" | "rescued" | "rest_complete";
