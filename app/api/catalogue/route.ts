import { findCatalogueByBarcode, searchCatalogue } from "@/lib/server/catalogue-store";
import type { CatalogueSearchResponse } from "@/lib/api/contract";

/**
 * GET /api/catalogue?q= — real local starter-catalogue search (Open Beauty Facts,
 * source_listed, ODbL). Results carry inciStatus "partial": identity is a real
 * listing, but the INCI is not verified and nothing is analysed until the user
 * confirms it. Membership here is NOT clinical verification.
 *
 * Bounded + abuse-controlled: query length capped, result count capped, no auth
 * required (read-only public library), no user data touched, cache disabled.
 */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const barcode = url.searchParams.get("barcode");
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 50) : 20;

  // Explicit barcode searches never fall through to fuzzy name matching.
  const barcodeMatch = barcode === null ? null : findCatalogueByBarcode(barcode);
  const results = barcode === null ? searchCatalogue(q, limit) : (barcodeMatch ? [barcodeMatch] : []);
  const body: CatalogueSearchResponse = { results };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
