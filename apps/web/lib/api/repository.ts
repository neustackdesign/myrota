import type {
  AcceptInviteResponse,
  AddShelfResponse,
  CatalogueSearchResponse,
  ClaimStatusResponse,
  ClientConfigResponse,
  CompletionRequest,
  CompletionResponse,
  CreateRotaRequest,
  DeclineRescueRequest,
  ExtractRequest,
  ExtractResponse,
  FriendsResponse,
  InvitePreviewResponse,
  InviteResponse,
  MeResponse,
  MixRequest,
  MixResponse,
  NextRotaRequest,
  PatchShelfRequest,
  ProductDraft,
  PutRemindersRequest,
  ReflectRequest,
  RemindersState,
  RescueRequest,
  RescueResponse,
  RotaResponse,
  ShareRequest,
  ShareResponse,
  ShelfResponse,
  SwapRecoveryRequest,
  TodayResponse,
} from "./contract";
import type { ShelfProduct } from "../domain/types";

/**
 * Everything the UI can ask of the backend. Screens receive an implementation
 * through RepositoryProvider; they never import storage or fetch directly.
 */
export interface RotaRepository {
  readonly mode: "http" | "demo";

  config(): Promise<ClientConfigResponse>;
  me(): Promise<MeResponse | null>;
  updateDisplayName(displayName: string): Promise<MeResponse>;

  shelf(): Promise<ShelfResponse>;
  addProduct(draft: ProductDraft): Promise<AddShelfResponse>;
  patchProduct(id: string, patch: PatchShelfRequest): Promise<ShelfProduct>;
  removeProduct(id: string): Promise<void>;
  searchCatalogue(query: string): Promise<CatalogueSearchResponse>;
  extract(req: ExtractRequest, image?: Blob): Promise<ExtractResponse>;

  mix(req: MixRequest): Promise<MixResponse>;

  createRota(req: CreateRotaRequest): Promise<RotaResponse>;
  currentRota(): Promise<RotaResponse | null>;
  today(): Promise<TodayResponse>;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  rescue(rotaId: string, req: RescueRequest): Promise<RescueResponse>;
  declineRescue(rotaId: string, req: DeclineRescueRequest): Promise<void>;
  swapRecovery(rotaId: string, req: SwapRecoveryRequest): Promise<RotaResponse>;
  reflect(rotaId: string, req: ReflectRequest): Promise<RotaResponse>;
  nextRota(req: NextRotaRequest): Promise<RotaResponse>;

  createInvite(): Promise<InviteResponse>;
  invitePreview(token: string): Promise<InvitePreviewResponse>;
  acceptInvite(token: string): Promise<AcceptInviteResponse>;
  friends(): Promise<FriendsResponse>;
  markFriendSeen(pairId: string): Promise<void>;

  share(req: ShareRequest): Promise<ShareResponse>;
  reminders(): Promise<RemindersState>;
  putReminders(req: PutRemindersRequest): Promise<RemindersState>;

  /** Claim: Google OAuth redirect. Resolves with the URL to navigate to. */
  startGoogleClaim(callbackPath: string): Promise<{ url: string }>;
  sendEmailCode(email: string, displayName: string | null): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  claimStatus(): Promise<ClaimStatusResponse>;
}

export type ApiErrorKind =
  | "network"
  | "unavailable"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "not_configured"
  | "server";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly correlationId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorMessage(error: unknown): string {
  // Verification failures occur before the first write. Surface the specific
  // retry guidance instead of hiding it behind a generic toast.
  if (error instanceof Error && error.name === "VerificationError") return error.message;
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "You're offline or the connection dropped. Nothing was saved.";
      case "unavailable":
        return "myrota's service isn't reachable right now. Nothing was saved.";
      case "unauthorized":
        return "Your session ended. Your saved data is safe; sign in again to continue.";
      case "rate_limited":
        return "Too many tries. Wait a minute, then try again.";
      case "conflict":
        return "Something changed in another tab or device. Refresh to see the latest.";
      case "validation":
        return error.message || "That didn't look right. Check and try again.";
      case "not_configured":
        return error.message;
      case "not_found":
        return "We couldn't find that.";
      default:
        return "Something went wrong on our side. Nothing was lost; try again.";
    }
  }
  return "Something went wrong. Try again.";
}
