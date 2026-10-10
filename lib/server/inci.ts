import type { ActiveClass, InciIngredient } from "@/lib/domain/types";

/**
 * Deterministic INCI name-normalisation + active-class detection.
 *
 * This is NAME-NORMALISATION ONLY (CosIng-style), never a safety judgement.
 * It maps a raw ingredient string to a canonical lowercase INCI name and, for a
 * small set of well-established, unambiguous actives, an ActiveClass. It never
 * invents an ingredient and never guesses: an unrecognised string normalises to
 * itself with activeClass = null.
 *
 * Active-class tagging feeds lib/domain/evidence.ts `evidenceActiveClasses`,
 * which still only counts the class when the product's INCI is analysable
 * (verified / user_confirmed). Source-listed or partial products therefore
 * contribute nothing to Mix/Rota until the user confirms the list.
 */

/** Lowercase, strip percentages/parentheticals/asterisks, collapse space, drop trailing punctuation. */
export function normalizeInciName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // (and other names), (1%), (coceth-7...) → drop
    .replace(/\b\d+(\.\d+)?\s*%/g, " ") // 2% → drop
    .replace(/[*†‡●•]/g, " ")
    .replace(/[．。]/g, ".")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:/-]+|[\s.,;:/-]+$/g, "")
    .trim();
}

/**
 * Canonical active lookup. Keys are normalised INCI names (already lowercased).
 * Deliberately conservative: only ingredients whose active identity is not in
 * meaningful dispute. pH adjusters used at trace (e.g. citric acid) are excluded
 * so we don't over-claim an AHA that isn't acting as one.
 */
const ACTIVE_BY_NAME: Record<string, ActiveClass> = {
  // retinoids
  "retinol": "retinoid",
  "retinal": "retinoid",
  "retinaldehyde": "retinoid",
  "retinyl palmitate": "retinoid",
  "retinyl retinoate": "retinoid",
  "hydroxypinacolone retinoate": "retinoid",
  "retinyl acetate": "retinoid",
  "tretinoin": "retinoid",
  "adapalene": "retinoid",
  // vitamin C
  "ascorbic acid": "vitamin_c",
  "l-ascorbic acid": "vitamin_c",
  "3-o-ethyl ascorbic acid": "vitamin_c",
  "ethyl ascorbic acid": "vitamin_c",
  "sodium ascorbyl phosphate": "vitamin_c",
  "magnesium ascorbyl phosphate": "vitamin_c",
  "ascorbyl glucoside": "vitamin_c",
  "tetrahexyldecyl ascorbate": "vitamin_c",
  "ascorbyl palmitate": "vitamin_c",
  // niacinamide
  "niacinamide": "niacinamide",
  "nicotinamide": "niacinamide",
  // AHAs
  "glycolic acid": "aha",
  "lactic acid": "aha",
  "mandelic acid": "aha",
  "malic acid": "aha",
  "tartaric acid": "aha",
  // BHA
  "salicylic acid": "bha",
  "capryloyl salicylic acid": "bha",
  "betaine salicylate": "bha",
  // azelaic
  "azelaic acid": "azelaic_acid",
  "potassium azeloyl diglycinate": "azelaic_acid",
  // benzoyl peroxide
  "benzoyl peroxide": "benzoyl_peroxide",
};

/** Synonyms / common label spellings → canonical normalised name. */
const SYNONYM: Record<string, string> = {
  "vitamin c": "ascorbic acid",
  "l ascorbic acid": "l-ascorbic acid",
  "ethyl ascorbic acid": "3-o-ethyl ascorbic acid",
  "vitamin b3": "niacinamide",
  "vitamin a": "retinol",
  "granactive retinoid": "hydroxypinacolone retinoate",
  "bha": "salicylic acid",
};

export function detectActiveClass(normalized: string): ActiveClass | null {
  const canonical = SYNONYM[normalized] ?? normalized;
  return ACTIVE_BY_NAME[canonical] ?? null;
}

/**
 * Turn raw label/catalogue ingredient strings into typed InciIngredient[].
 * status defaults to "read" (seen on a source), NOT verified. An empty/garbage
 * line is kept as "unreadable" so the product degrades to partial, never silently
 * dropped. Never invents text.
 */
export function toInciIngredients(rawLines: string[], idPrefix = "ing"): InciIngredient[] {
  return rawLines.map((raw, index) => {
    const text = raw.trim().slice(0, 200);
    const normalized = normalizeInciName(text);
    const readable = normalized.length >= 2 && /[a-z]/.test(normalized);
    return {
      id: `${idPrefix}-${index + 1}`,
      text,
      normalized: readable ? normalized : null,
      status: readable ? ("read" as const) : ("unreadable" as const),
      activeClass: readable ? detectActiveClass(normalized) : null,
      flagged: false,
    };
  });
}

/**
 * Split a declared INCI blob into ingredient strings at deterministic
 * separators only (comma, semicolon, newline, middle dot), while retaining
 * numeric ingredient names such as 1,2-Hexanediol and PEG-12,4 compounds. Caps the count to avoid abuse.
 */
export function splitInciList(blob: string, max = 200): string[] {
  const clean = blob.replace(/^\s*ingredients?\s*[:：]\s*/i, "").replace(/\r\n?/g, "\n");
  return clean
    .split(/(?<!\d),\s*|,\s*(?!\d)|[;\n·•]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}
