import type { ProductCategory, LabelActive } from "../domain/types";

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
  labelActives: LabelActive[];
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

/**
 * Parse ONLY the visible Drug Facts "Active ingredients" declarations.
 * A limited dictionary prevents marketing claims and unrecognised chemistry
 * from being silently treated as labelled drug actives. Names and percentages
 * must BOTH occur in the transcribed text, near an Active ingredients heading.
 * A matching list is NEVER considered a complete inactive/INCI declaration.
 */
const DECLARED_ACTIVES: Record<string, string> = {
  avobenzone: "Avobenzone",
  homosalate: "Homosalate",
  octisalate: "Octisalate",
  octocrylene: "Octocrylene",
  octinoxate: "Octinoxate",
  oxybenzone: "Oxybenzone",
  "zinc oxide": "Zinc Oxide",
  "titanium dioxide": "Titanium Dioxide",
  ensulizole: "Ensulizole",
  meradimate: "Meradimate",
  "padimate o": "Padimate O",
  sulisobenzone: "Sulisobenzone",
  ecamsule: "Ecamsule",
  "benzoyl peroxide": "Benzoyl Peroxide",
  "salicylic acid": "Salicylic Acid",
  sulfur: "Sulfur",
};

export function parseLabelActives(visibleText: string): LabelActive[] {
  const start = visibleText.search(/\\bactive\\s+ingredients?\\s*:?/i);
  if (start < 0) return [];
  const region = visibleText.slice(start, start + 900);
  const list: LabelActive[] = [];
  for (const [lowerName, labelName] of Object.entries(DECLARED_ACTIVES)) {
    const escaped = lowerName.replace(/[.*+?^${}()|[\\]\\]/g, "\\export function parseFrontLabel(raw: string): FrontIdentity | null {");
    const match = new RegExp(`\\b${escaped}\\s*[:\\-]?\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*%`, "i").exec(region);
    if (!match) continue;
    const percentage = Number(match[1]);
    if (percentage > 0 && percentage <= 100 && Number.isFinite(percentage)) {
      list.push({ name: labelName, percentage });
    }
  }
  return list.slice(0, 12);
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
  return { brand, name, category: safeCategory, variant, visibleText, labelActives: parseLabelActives(visibleText) };
}
