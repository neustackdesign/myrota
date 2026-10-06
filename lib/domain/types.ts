export type ProductFormat = "rinse_off" | "leave_on";

export type ProductKind =
  | "cleanser"
  | "treatment"
  | "moisturiser"
  | "sunscreen";

export type ActiveClass =
  | "retinoid"
  | "aha"
  | "bha"
  | "vitamin_c_laa"
  | "niacinamide"
  | "azelaic_acid"
  | "sunscreen"
  | "hydrator";

export type Relationship =
  | "compatible"
  | "caution"
  | "alternate"
  | "avoid"
  | "insufficient_evidence";

export type RelationshipReason =
  | "irritation"
  | "pregnancy"
  | "formulation"
  | "duplication"
  | "prescription"
  | "unknown";

export interface Product {
  id: string;
  brand: string;
  name: string;
  kind: ProductKind;
  format: ProductFormat;
  activeClasses: ActiveClass[];
  source: "seed_fixture";
  confidence: "fixture";
}

export interface Rule {
  id: string;
  classA: ActiveClass;
  classB: ActiveClass;
  relationship: Relationship;
  reason: RelationshipReason;
  explanation: string;
  sourceRefs: string[];
  reviewedBy: string[];
  status: "draft" | "reviewed";
}

export interface RoutineContext {
  retinoidExperience?: "new" | "regular";
}

export interface RoutineStep {
  productId: string;
  productName: string;
  brand: string;
  note?: string;
}

export interface RoutineSession {
  label: "AM" | "PM";
  steps: RoutineStep[];
  theme?: string;
}

export interface RotaDay {
  index: number;
  label: string;
  am: RoutineSession;
  pm: RoutineSession;
}

export interface ShelfObservation {
  id: string;
  title: string;
  detail: string;
}

export interface Rota {
  id: string;
  createdAt: string;
  startDate: string;
  productIds: string[];
  days: RotaDay[];
  observations: ShelfObservation[];
  explanation: string;
}

export interface DayCompletion {
  am: boolean;
  pm: boolean;
}

export interface AppState {
  selectedProductIds: string[];
  context: RoutineContext;
  rota: Rota | null;
  completions: Record<number, DayCompletion>;
  rescuedDayIndex?: number;
}
