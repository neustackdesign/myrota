/**
 * Typed HTTP surfaces the UI consumes. Mirrors docs/IMPLEMENTATION_HANDOFF.md.
 * Shapes marked PROPOSED are not in the handoff yet; they are listed in
 * docs/UI_HANDOFF_V1_2.md for ChatGPT/infra to accept, rename or reject.
 * The UI never creates competing endpoints: it only calls these.
 */
import type { MemberToday } from "../domain/friend-streak";
import type { MixResult } from "../domain/mix";
import type { ShareCardPayload } from "../domain/share";
import type {
  CatalogueProduct,
  CompletionSession,
  DayRecord,
  EvidenceStatus,
  Feeling,
  IanaTimeZone,
  ISODateTime,
  InciIngredient,
  PlanContext,
  ProductCategory,
  ProductFormat,
  RotaSnapshot,
  SafetyFlag,
  ShelfProduct,
  SkincareDate,
  UserPlacement,
} from "../domain/types";

export type IdentityProvider = "google" | "email" | "apple";

/** GET /api/me */
export interface MeResponse {
  userId: string;
  isAnonymous: boolean;
  displayName: string | null;
  identityProviders: IdentityProvider[];
  hasRota: boolean;
}

/** Server-controlled feature flags. Absent/false = the client must keep the flow disabled. */
export interface ClientCapabilities {
  photoReading: boolean;
  catalogue: boolean;
}

/** PROPOSED · GET /api/config — which sign-in methods are actually configured. Apple is never shown unless true. */
export interface ClientConfigResponse {
  providers: { google: boolean; emailOtp: boolean; apple: boolean };
  turnstileSiteKey: string | null;
  vapidPublicKey: string | null;
  /** Backward-compatible addition (Issue #7). Absent must be read as all-disabled. */
  capabilities?: ClientCapabilities;
}

/** GET /api/shelf */
export interface ShelfResponse {
  products: ShelfProduct[];
}

/** What the Review screen confirms before POST /api/shelf. */
export interface ProductDraft {
  brand: string;
  name: string;
  category: ProductCategory;
  format: ProductFormat;
  identityStatus: EvidenceStatus;
  inciStatus: EvidenceStatus;
  identityKey?: string | null;
  variant?: string | null;
  ingredients: InciIngredient[];
  placement?: UserPlacement;
  source: ShelfProduct["source"];
  /** Set when the draft came from a catalogue result or an extraction, so the server can re-verify. */
  catalogueId?: string | null;
  extractionId?: string | null;
}

/** POST /api/shelf */
export interface AddShelfRequest {
  draft: ProductDraft;
}
export interface AddShelfResponse {
  product: ShelfProduct;
  /** True when the server matched an existing shelf item (same verified SKU / confirmed signature). */
  duplicate: boolean;
}

/** PATCH /api/shelf/:id */
export interface PatchShelfRequest {
  name?: string;
  brand?: string;
  category?: ProductCategory;
  format?: ProductFormat;
  placement?: UserPlacement;
  finished?: boolean;
  /** text null = "it's not on the label" (remove). Corrections stay `corrected`, never verified. */
  ingredientCorrections?: { ingredientId: string; text: string | null }[];
}

/** PROPOSED · GET /api/catalogue?q= — product library search (the handoff names search but no endpoint). */
export interface CatalogueSearchResponse {
  results: CatalogueProduct[];
}

export type ExtractMethod = "scan" | "gallery" | "paste";
export type ExtractProblem = "glare" | "blur" | "no_text" | "not_ingredient_list" | "too_large" | "unsupported_image";

/** POST /api/extract — candidate only; never saves a product, never returns safety verdicts. */
export interface ExtractRequest {
  method: ExtractMethod;
  /** Front-label shot used only when identity could not be read. */
  side: "back" | "front";
  pastedText?: string;
}
export interface ExtractionCandidate {
  extractionId: string;
  brand: string | null;
  name: string | null;
  category: ProductCategory | null;
  /** Format must be evidenced or explicitly unknown; never default to leave-on. */
  format: ProductFormat | null;
  identityStatus: EvidenceStatus;
  inciStatus: EvidenceStatus;
  identityKey: string | null;
  variant: string | null;
  ingredients: InciIngredient[];
  /** Flags may only come from reviewed rules / verified alerts; the server decides. */
  flags: SafetyFlag[];
  provider: string;
}
export type ExtractResponse = { ok: true; candidate: ExtractionCandidate } | { ok: false; problem: ExtractProblem };

/** POST /api/mix */
export type MixSubjectRef =
  | { kind: "shelf"; shelfProductId: string }
  | { kind: "catalogue"; catalogueId: string }
  | { kind: "unknown"; name: string };
export interface MixRequest {
  a: MixSubjectRef;
  b: MixSubjectRef;
}
export interface MixResponse {
  result: MixResult;
  names: [string, string];
}

/** POST /api/rotas — context is sent transiently and must not be persisted server-side. */
export interface CreateRotaRequest {
  context: PlanContext;
  idempotencyKey: string;
  /** Mix Check pair carried into the builder, so the server can return the plan-derived note. */
  mixPair?: { a: MixSubjectRef; b: MixSubjectRef } | null;
}
export interface RotaResponse {
  rota: RotaSnapshot;
  /** Derived from the actual verdict AND the actual plan (domain mixNoteForRota). */
  mixNote?: string | null;
}

export interface FriendSummary {
  pairId: string;
  displayName: string;
  /** Initials only; never a photo until the friend has one on their real identity. */
  initials: string;
  today: MemberToday;
  friendStreak: number;
  pairTodayCounted: boolean;
  joinedAt: ISODateTime;
  /** Inviter has not yet seen the joined moment. */
  newlyJoined: boolean;
}

/** GET /api/today — raw dated data; the UI derives the view with domain buildTodayView. */
export interface TodayResponse {
  serverNow: ISODateTime;
  timeZone: IanaTimeZone;
  rota: RotaSnapshot | null;
  /** Current + previous rota, so a Rescue can cross the week boundary. */
  rotas: RotaSnapshot[];
  records: DayRecord[];
  friends: FriendSummary[];
}

/** POST /api/completions */
export interface CompletionRequest {
  rotaId: string;
  skincareDate: SkincareDate;
  session: CompletionSession;
  idempotencyKey: string;
}
export interface CompletionResponse {
  record: DayRecord;
}

/** POST /api/rotas/:id/rescue */
export interface RescueRequest {
  missedSkincareDate: SkincareDate;
  idempotencyKey: string;
}
export interface RescueResponse {
  record: DayRecord;
  rota: RotaSnapshot;
}

/** PROPOSED · POST /api/rotas/:id/rescue/decline — "Let it go" ends the hold before expiry. */
export interface DeclineRescueRequest {
  missedSkincareDate: SkincareDate;
  idempotencyKey: string;
}

/** POST /api/rotas/:id/swap-recovery */
export interface SwapRecoveryRequest {
  skincareDate: SkincareDate;
  idempotencyKey: string;
}

/** POST /api/rotas/:id/reflect */
export interface ReflectRequest {
  feeling: Feeling;
  idempotencyKey: string;
}

/** POST /api/rotas/next — archives once; finished products leave the next rota. */
export interface NextRotaRequest {
  idempotencyKey: string;
  context: PlanContext;
}

/** POST /api/invites */
export interface InviteResponse {
  token: string;
  url: string;
}
/** PROPOSED · GET /api/invites/:token — public, safe fields only (for /i/[token]). */
export interface InvitePreviewResponse {
  status: "active" | "expired" | "not_found";
  inviterDisplayName: string | null;
  inviterStreak: number | null;
}
/** POST /api/invites/:token/accept */
export interface AcceptInviteResponse {
  friend: FriendSummary;
  alreadyPaired: boolean;
}

/** GET /api/friends */
export interface FriendsResponse {
  friends: FriendSummary[];
  inviteToken: string | null;
}

/** PROPOSED · PATCH /api/me — user-typed display name only. */
export interface UpdateMeRequest {
  displayName: string;
}

/** POST /api/share */
export interface ShareRequest {
  card: ShareCardPayload;
}
export interface ShareResponse {
  url: string;
  imageUrl: string | null;
}

/** GET/PUT /api/reminders */
export interface RemindersState {
  am: string;
  pm: string;
  enabled: boolean;
  timeZone: IanaTimeZone;
  pushSubscribed: boolean;
}
export interface PutRemindersRequest {
  am: string;
  pm: string;
  enabled: boolean;
  timeZone: IanaTimeZone;
  subscription?: unknown;
}

/** PROPOSED · GET /api/account/claim-status — so the UI never pretends a claim/merge succeeded. */
export interface ClaimStatusResponse {
  state: "none" | "pending" | "committed" | "failed";
  correlationId: string | null;
}

/** Better Auth email OTP (standard plugin routes under /api/auth). */
export interface EmailOtpSendRequest {
  email: string;
  type: "sign-in";
}
