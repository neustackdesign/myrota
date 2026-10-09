/**
 * Pure, binding-free validators for the extract endpoint. Kept separate so they
 * can be unit-tested without the Worker runtime.
 */

/** Real file-signature check — never trust the declared Content-Type. */
export function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

/** A real INCI list has separators and recognisable cosmetic tokens. */
export function looksLikeIngredientList(text: string, entries: string[]): boolean {
  if (entries.length < 3) return false;
  const hasSeparators = /[,;·•]/.test(text) || entries.length >= 5;
  const hasKnownToken = /\b(aqua|water|glycerin|glycerine|niacinamide|acid|sodium|alcohol|oil|extract|butter|dimethicone)\b/i.test(text);
  return hasSeparators && hasKnownToken;
}
