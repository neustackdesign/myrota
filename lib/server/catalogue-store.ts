import type { CatalogueProduct, ProductCategory, ProductFormat } from "@/lib/domain/types";
import { toInciIngredients } from "./inci";
import catalogueData from "./catalogue-data.json";
import manufacturerRecords from "./catalogue-manufacturer.json";

/**
 * Local, provenance-bearing starter catalogue search.
 *
 * Data is baked from Open Beauty Facts (ODbL) by scripts/ingest/build-catalogue.mjs.
 * It is `source_listed` discovery data — NEVER clinical verification. Every result
 * carries inciStatus "partial" so nothing enters Mix/Rota until the user confirms
 * the ingredient list on the Review screen. Provenance stays server-side and is
 * used to re-resolve a record when a product is added to the Shelf by catalogueId.
 */

export type CatalogueProvenanceLevel = "source_listed" | "user_confirmed" | "pharmacist_reviewed";

export interface CatalogueProvenance {
  source: string;
  sourceUrl: string;
  observedAt: string;
  level: CatalogueProvenanceLevel;
  license: string;
}

interface RawRecord {
  catalogueId: string;
  barcode: string;
  brand: string;
  name: string;
  category: ProductCategory;
  format: ProductFormat;
  variant: string | null;
  ingredientStrings: string[];
  provenance: CatalogueProvenance;
}

interface IndexedRecord {
  product: CatalogueProduct;
  provenance: CatalogueProvenance;
  haystack: string; // lowercased brand + name + variant for matching
}

// Manufacturer observations are maintained separately from ODbL imports;
// each market/formulation is independently attributed and is never assumed
// to match a physical SKU without barcode or packaging confirmation.
const SOURCE_RECORDS = [...(catalogueData as { products: RawRecord[] }).products,
  ...(manufacturerRecords as { products: RawRecord[] }).products];
const INDEX: IndexedRecord[] = SOURCE_RECORDS.map((r) => ({
  product: {
    catalogueId: r.catalogueId,
    brand: r.brand,
    name: r.name,
    category: r.category,
    format: r.format,
    identityKey: r.barcode || null, // no invented GTIN for manufacturer-listed products
    variant: r.variant,
    ingredients: toInciIngredients(r.ingredientStrings, r.catalogueId.replace(/[^a-z0-9]/gi, "")),
    inciStatus: "partial", // source-listed; user must confirm before it is analysable
  },
  provenance: r.provenance,
  haystack: `${r.brand} ${r.name} ${r.variant ?? ""}`.toLowerCase(),
}));

/**
 * Canonical GTIN is a 14-digit string, including meaningful leading zeroes.
 * Accept only GTIN-8, UPC-A (12), EAN-13, or GTIN-14 with a valid GS1 check
 * digit. Never fuzzy-match numeric identifiers: wrong SKU must return no hit.
 */
export function canonicalGtin(raw: string): string | null {
  const code = raw.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  const digits = Array.from(code, Number);
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits[digits.length - 1] === checkDigit ? code.padStart(14, "0") : null;
}

const BY_ID = new Map(INDEX.map((x) => [x.product.catalogueId, x]));
const BY_BARCODE = new Map<string, IndexedRecord>();
for (const item of INDEX) {
  const barcode = canonicalGtin(item.product.identityKey);
  if (barcode && !BY_BARCODE.has(barcode)) BY_BARCODE.set(barcode, item);
}

/** Barcode identity does not prove the formula, source recency or clinical safety. */
export function findCatalogueByBarcode(rawCode: string): CatalogueProduct | null {
  const code = canonicalGtin(rawCode);
  return code ? (BY_BARCODE.get(code)?.product ?? null) : null;
}

export const catalogueSize = INDEX.length;

/** Server-side record for ownership/provenance re-verification on Shelf add. Never trusts client claims. */
export function getCatalogueRecord(catalogueId: string): IndexedRecord | null {
  return BY_ID.get(catalogueId) ?? null;
}

/**
 * Bounded, deterministic search. Scores exact brand/name hits above token hits.
 * Empty / too-short query returns no results (the UI shows the real empty state).
 */
export function searchCatalogue(rawQuery: string, limit = 20): CatalogueProduct[] {
  const q = rawQuery.trim().toLowerCase().slice(0, 80);
  if (/^\d{8,14}$/.test(q)) {
    const exact = findCatalogueByBarcode(q);
    return exact ? [exact] : [];
  }
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 8);
  if (!tokens.length) return [];

  const scored: { r: IndexedRecord; score: number }[] = [];
  for (const r of INDEX) {
    let score = 0;
    if (r.haystack.includes(q)) score += 100; // whole-query phrase match
    for (const t of tokens) if (r.haystack.includes(t)) score += 10;
    // Every token must appear somewhere, else it is not a real match.
    const allTokens = tokens.every((t) => r.haystack.includes(t));
    if (score > 0 && allTokens) scored.push({ r, score });
  }
  scored.sort((a, b) => b.score - a.score || a.r.product.brand.localeCompare(b.r.product.brand));
  return scored.slice(0, Math.min(limit, 50)).map((x) => x.r.product);
}
