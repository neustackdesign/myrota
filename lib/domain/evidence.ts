import type {
  AcceptedStatuses,
  ActiveClass,
  EvidenceStatus,
  InciIngredient,
  RegulatoryNotice,
  SafetyFlag,
  ShelfProduct,
} from "./types";
import { PRODUCTION_ACCEPTED } from "./types";

/**
 * Product evidence rules.
 *
 * - Identity and ingredient (INCI) confidence are independent. Confirming or
 *   correcting the NAME never upgrades the ingredients.
 * - A user correction is `corrected`: local and provisional. It is never
 *   promoted to `verified` here; only server-side corroboration can do that.
 * - Only verified or user-confirmed INCI is analysable. Partial, unknown and
 *   corrected products may sit on the Shelf but never enter pairing checks or
 *   clinically material scheduling.
 */

const ANALYSABLE: EvidenceStatus[] = ["verified", "user_confirmed"];

export function isAnalysable(product: Pick<ShelfProduct, "inciStatus">): boolean {
  return ANALYSABLE.includes(product.inciStatus);
}

/** Active classes backed by evidence. Corrected or unreadable lines never contribute. */
export function evidenceActiveClasses(product: Pick<ShelfProduct, "inciStatus" | "ingredients">): ActiveClass[] {
  if (!isAnalysable(product)) return [];
  const out = new Set<ActiveClass>();
  for (const ing of product.ingredients) {
    if ((ing.status === "verified" || ing.status === "read") && ing.activeClass) out.add(ing.activeClass);
  }
  return [...out];
}

function inciStatusAfterEdit(current: EvidenceStatus, ingredients: InciIngredient[]): EvidenceStatus {
  if (ingredients.length === 0) return "unknown";
  if (ingredients.some((i) => i.status === "corrected")) return "corrected";
  if (ingredients.some((i) => i.status === "unreadable")) return current === "unknown" ? "unknown" : "partial";
  return current;
}

/** Correct one ingredient chip as typed by the user. Never yields `verified`. */
export function correctIngredient(product: ShelfProduct, ingredientId: string, text: string): ShelfProduct {
  const trimmed = text.trim();
  const ingredients = product.ingredients.map((ing) =>
    ing.id === ingredientId
      ? trimmed
        ? { ...ing, text: trimmed, normalized: null, status: "corrected" as const, activeClass: null, flagged: false }
        : ing
      : ing,
  );
  return { ...product, ingredients, inciStatus: inciStatusAfterEdit(product.inciStatus, ingredients) };
}

/** "It's not on the label": removing a line is also a user correction. */
export function removeIngredient(product: ShelfProduct, ingredientId: string): ShelfProduct {
  if (!product.ingredients.some((i) => i.id === ingredientId)) return product;
  const ingredients = product.ingredients.filter((i) => i.id !== ingredientId);
  const status = ingredients.length === 0 ? "unknown" : "corrected";
  return { ...product, ingredients, inciStatus: status };
}

/** User typed or confirmed the name. Affects identity only. */
export function confirmIdentity(product: ShelfProduct, name: string, brand?: string): ShelfProduct {
  const nextName = name.trim();
  if (!nextName) return product;
  const changed = nextName !== product.name || (brand !== undefined && brand.trim() !== product.brand);
  const identityStatus: EvidenceStatus =
    product.identityStatus === "verified" && !changed ? "verified" : changed && product.identityStatus === "verified" ? "corrected" : "user_confirmed";
  return {
    ...product,
    name: nextName,
    brand: brand !== undefined ? brand.trim() : product.brand,
    identityStatus,
    // Deliberately unchanged: ingredient confidence is a separate dimension.
    inciStatus: product.inciStatus,
  };
}

// ---------------------------------------------------------------------------
// Safety flags
// ---------------------------------------------------------------------------

/**
 * A named-product regulator alert applies ONLY when the shelf product's
 * identity is VERIFIED to the exact SKU + variant the notice names and the
 * notice links an authoritative URL. An OCR guess or a user-typed name is
 * never enough.
 */
export function regulatoryAlertApplies(
  product: Pick<ShelfProduct, "identityStatus" | "identityKey" | "variant">,
  notice: RegulatoryNotice | null | undefined,
): boolean {
  if (!notice) return false;
  if (product.identityStatus !== "verified") return false;
  if (!product.identityKey || product.identityKey !== notice.productIdentityKey) return false;
  if ((product.variant ?? "") !== notice.variant) return false;
  return /^https:\/\/\S+$/.test(notice.url);
}

/** A label-declared flag requires the flagged ingredient to have actually been read on the label. */
export function labelFlagApplies(product: Pick<ShelfProduct, "ingredients">) {
  return product.ingredients.some((i) => i.flagged && (i.status === "read" || i.status === "verified"));
}

/** Flags that may render, given which rule statuses the caller accepts. */
export function visibleSafetyFlags(product: ShelfProduct, accepted: AcceptedStatuses = PRODUCTION_ACCEPTED): SafetyFlag[] {
  return product.flags.filter((flag) => {
    if (!accepted.includes(flag.status)) return false;
    if (flag.status === "reviewed" && flag.reviewers.length === 0) return false;
    if (flag.kind === "regulatory_alert") return regulatoryAlertApplies(product, flag.notice);
    return labelFlagApplies(product);
  });
}

/** A product with a visible flag is kept on the Shelf and out of the rota. */
export function isHeldBySafetyFlag(product: ShelfProduct, accepted: AcceptedStatuses = PRODUCTION_ACCEPTED) {
  return visibleSafetyFlags(product, accepted).length > 0;
}

export const PROVENANCE_LABEL: Record<EvidenceStatus, string> = {
  verified: "Verified · matched to library",
  user_confirmed: "You confirmed this",
  partial: "Partly read · left out of checks",
  unknown: "Unknown · not analysed",
  corrected: "You corrected this · awaiting confirmation",
};
