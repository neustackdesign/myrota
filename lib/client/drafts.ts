import type { ExtractionCandidate, ExtractProblem, ProductDraft } from "../api/contract";
import { evidenceActiveClasses } from "../domain/evidence";
import type { CatalogueProduct, ShelfProduct, UserPlacement } from "../domain/types";

export function draftFromCatalogue(c: CatalogueProduct): ProductDraft {
  return {
    brand: c.brand,
    name: c.name,
    category: c.category,
    format: c.format,
    identityStatus: "verified",
    inciStatus: c.inciStatus,
    identityKey: c.identityKey,
    variant: c.variant ?? null,
    ingredients: c.ingredients,
    source: "search",
    catalogueId: c.catalogueId,
  };
}

export function draftForUnknown(name: string, placement: UserPlacement): ProductDraft {
  return {
    brand: "",
    name,
    category: "other",
    format: "unknown",
    identityStatus: "unknown",
    inciStatus: "unknown",
    identityKey: null,
    ingredients: [],
    placement,
    source: "manual",
  };
}

export function draftFromCandidate(c: ExtractionCandidate, method: "scan" | "gallery" | "paste"): ProductDraft {
  return {
    brand: c.brand ?? "",
    name: c.name ?? "",
    category: c.category ?? "other",
    format: c.format ?? "unknown",
    identityStatus: c.identityStatus,
    inciStatus: c.inciStatus,
    identityKey: c.identityKey,
    variant: c.variant,
    ingredients: c.ingredients,
    source: method,
    extractionId: c.extractionId,
  };
}

/**
 * Context questions are asked only when they can change the plan: the
 * retinoid question only with an evidence-backed retinoid on the shelf; the
 * care question only with any evidence-backed active. Never inferred.
 */
export function contextNeeds(products: ShelfProduct[]) {
  const classes = new Set(products.filter((p) => !p.finishedAt).flatMap((p) => evidenceActiveClasses(p)));
  return { retinoid: classes.has("retinoid"), care: classes.size > 0 };
}

export const PROBLEM_TEXT: Record<ExtractProblem, string> = {
  glare: "Glare on the label. Tilt the bottle away from the light and try again.",
  blur: "The photo is blurred. Hold still a moment, then try again.",
  no_text: "We couldn't find any text. Fill the frame with the ingredient list.",
  not_ingredient_list: "That doesn't look like an ingredient list. Try the back label.",
  too_large: "That image is too large. Try a closer photo.",
  unsupported_image: "We can't read that file type. Try a JPG or PNG photo.",
};

