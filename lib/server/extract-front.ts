import type { ProductCategory } from "../domain/types";

/**
 * Interprets a front-label OCR response. Nothing here makes a verified SKU or
 * formula. Model-proposed names must be corroborated by its literal visible
 * transcription before being passed to a user for confirmation.
 */
export interface FrontIdentity {
  brand: string | null;
  name: string | null;
  category: ProductCategory | null;
  variant: string | null;
  visibleText: string;
}

const CATEGORIES = new Set<ProductCategory>([
  "cleanser", "toner", "serum", "treatment", "moisturiser", "sunscreen", "other",
]);
const normalize = (v: string) => v.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function corroborates(value: string, visible: string, minimum = 1): boolean {
  const words = normalize(value).split(" ").filter((v) => v.length >= 2 || /^\d+$/.test(v));
  if (words.length < minimum) return false;
  const visibleWords = new Set(normalize(visible).split(" "));
  // Require *all* meaningful words for short brands, most for product names.
  const hit = words.filter((w) => visibleWords.has(w)).length;
  return hit >= (words.length <= 2 ? words.length : Math.ceil(words.length * 0.7));
}

export function parseFrontLabel(raw: string): FrontIdentity | null {
  if (!raw || raw.length > 9000) return null;
  const cleaned = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  let value: unknown;
  try { value = JSON.parse(cleaned); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const visibleText = typeof v.visible_text === "string" ? v.visible_text.trim().slice(0, 1400) : "";
  if (visibleText.length < 8 || /^unreadable$/i.test(visibleText)) return null;
  const fromField = (key: string): string | null => {
    const item = v[key];
    return typeof item === "string" && item.trim() && item.length <= 180 ? item.trim() : null;
  };
  const brandValue = fromField("brand");
  const nameValue = fromField("name");
  const variantValue = fromField("size");
  const category = fromField("category");
  const brand = brandValue && corroborates(brandValue, visibleText) ? brandValue : null;
  const name = nameValue && corroborates(nameValue, visibleText, 2) ? nameValue : null;
  // A visible category word is required; do not infer format or skincare actives.
  const safeCategory = category && CATEGORIES.has(category as ProductCategory)
    && corroborates(category, visibleText) ? category as ProductCategory : null;
  const variant = variantValue && corroborates(variantValue, visibleText) ? variantValue : null;
  if (!name) return null;
  return { brand, name, category: safeCategory, variant, visibleText };
}
