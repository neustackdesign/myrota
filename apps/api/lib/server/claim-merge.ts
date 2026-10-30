/**
 * Pure, non-destructive staging function for an anonymous -> claimed identity merge.
 *
 * NOT an authentication proof, DB transaction, or complete account-merge endpoint.
 * The caller MUST verify control of both identities, persist all staged results
 * atomically/idempotently, recompute streak from real dated events, and only then
 * retire the anonymous identity. No safety/private context accepted here.
 */
export type EvidenceStatus = "verified" | "user_confirmed" | "partial" | "unknown" | "corrected";

export interface MergeShelf {
  id: string;
  ownerUserId: string;
  identityKey?: string | null;
  brand: string;
  productName: string;
  productType: string;
  identityConfidence: EvidenceStatus;
  ingredientConfidence: EvidenceStatus;
  /** Versioned record references; never promote edited INCI as verified. */
  evidenceRefs: string[];
}

export type DayStatus = "completed" | "rest_complete" | "missed" | "rescued";

export interface MergeDay {
  id: string;
  ownerUserId: string;
  skincareDate: string; // YYYY-MM-DD
  timeZone: string; // IANA, never UTC date inference
  status: DayStatus;
  /** Real user completion event ID. A false claim cannot beat a miss. */
  completionEventId?: string;
}

export interface MergePair {
  id: string;
  memberA: string;
  memberB: string;
}

export interface MergeInvite {
  token: string;
  inviterId: string;
}

export interface MergeInput {
  guestUserId: string;
  targetUserId: string;
  guestShelf: MergeShelf[];
  targetShelf: MergeShelf[];
  guestDays: MergeDay[];
  targetDays: MergeDay[];
  guestPairs: MergePair[];
  targetPairs: MergePair[];
  guestInvites: MergeInvite[];
  targetInvites: MergeInvite[];
}

export interface MergePlan {
  shelf: MergeShelf[];
  days: MergeDay[];
  pairs: MergePair[];
  invites: MergeInvite[];
  requiresStreakRecompute: true;
  requiresLocalSafetyContextReconfirmation: true;
  /**
   * Conservative duplicate-policy warnings, for a human or automated review.
   * This plan does not endorse medical claims or elevate confidence.
   */
  warnings: string[];
}

function keyOfShelf(p: MergeShelf): string | null {
  // Verified identity keys must include variant/SKU. Never fuzzily merge
  // unknown products just because names sound alike.
  return p.identityKey?.trim() ? p.identityKey.trim().toLowerCase() : null;
}

function chooseShelf(target: MergeShelf, guest: MergeShelf, owner: string): MergeShelf {
  // Existing account remains source of visible product details. Merge evidence
  // references, not clinical certainty or ambiguous name/format attributes.
  return {
    ...target,
    ownerUserId: owner,
    evidenceRefs: [...new Set([...target.evidenceRefs, ...guest.evidenceRefs])],
  };
}

function keyOfDay(p: MergeDay): string {
  // Distinct IANA timezone histories are kept separately for later
  // chronological reconciliation; never silently rewrite a local day.
  return p.skincareDate + "|" + p.timeZone;
}

function provenCompletion(p: MergeDay): boolean {
  return (p.status === "completed" || p.status === "rest_complete") &&
    typeof p.completionEventId === "string" && p.completionEventId.length > 0;
}
function rankDay(p: MergeDay): number {
  if (provenCompletion(p)) return 3;
  if (p.status === "rescued") return 2;
  if (p.status === "missed") return 1;
  return 0; // unproven "completed" event cannot outrank a known miss
}

export function planAccountMerge(input: MergeInput): MergePlan {
  const { guestUserId, targetUserId } = input;
  if (!guestUserId || !targetUserId || guestUserId === targetUserId) {
    throw new Error("Invalid distinct identities for guest claim");
  }

  const warnings: string[] = [];
  const remap = (id: string) => id === guestUserId ? targetUserId : id;

  const shelf: MergeShelf[] = [];
  const index = new Map<string, number>();
  for (const p of [...input.targetShelf, ...input.guestShelf]) {
    if (![guestUserId, targetUserId].includes(p.ownerUserId)) {
      throw new Error("Shelf item from unrelated identity");
    }
    const identityKey = keyOfShelf(p);
    if (identityKey && index.has(identityKey)) {
      const i = index.get(identityKey)!;
      shelf[i] = chooseShelf(shelf[i], p, targetUserId);
    } else {
      if (identityKey) index.set(identityKey, shelf.length);
      shelf.push({ ...p, ownerUserId: targetUserId, evidenceRefs: [...p.evidenceRefs] });
    }
  }

  const daysByDate = new Map<string, MergeDay>();
  for (const d of [...input.targetDays, ...input.guestDays]) {
    if (![guestUserId, targetUserId].includes(d.ownerUserId)) {
      throw new Error("Day record from unrelated identity");
    }
    const k = keyOfDay(d);
    const prev = daysByDate.get(k);
    if (!prev || rankDay(d) > rankDay(prev)) daysByDate.set(k, { ...d, ownerUserId: targetUserId });
    if (d.status === "completed" && !provenCompletion(d)) {
      warnings.push("Unproven completed day " + d.id + " is not an earned completion");
    }
  }

  const pairByMembers = new Map<string, MergePair>();
  for (const p of [...input.targetPairs, ...input.guestPairs]) {
    if (!([guestUserId, targetUserId].includes(p.memberA) ||
          [guestUserId, targetUserId].includes(p.memberB))) {
      throw new Error("Pair from unrelated identity");
    }
    const a = remap(p.memberA), b = remap(p.memberB);
    if (a === b) { warnings.push("Removed self-pair " + p.id); continue; }
    const key = [a, b].sort().join("|");
    if (!pairByMembers.has(key)) pairByMembers.set(key, { ...p, memberA: a, memberB: b });
  }

  const inviteByToken = new Map<string, MergeInvite>();
  for (const inv of [...input.targetInvites, ...input.guestInvites]) {
    if (![guestUserId, targetUserId].includes(inv.inviterId)) {
      throw new Error("Invite from unrelated identity");
    }
    const prev = inviteByToken.get(inv.token);
    if (prev && remap(prev.inviterId) !== remap(inv.inviterId)) {
      throw new Error("Conflicting invite ownership");
    }
    inviteByToken.set(inv.token, { ...inv, inviterId: targetUserId });
  }

  return {
    shelf,
    days: [...daysByDate.values()].sort((a, b) =>
      a.skincareDate.localeCompare(b.skincareDate) || a.timeZone.localeCompare(b.timeZone)),
    pairs: [...pairByMembers.values()],
    invites: [...inviteByToken.values()],
    requiresStreakRecompute: true,
    requiresLocalSafetyContextReconfirmation: true,
    warnings,
  };
}
