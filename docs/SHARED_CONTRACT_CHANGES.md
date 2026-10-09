# Shared contract changes (Issue #7) — for the frontend owner

All additive and backward-compatible. No existing field renamed or removed. Frontend files are not touched by the backend branch.

## 1. `GET /api/config` — new optional `capabilities`
```ts
interface ClientConfigResponse {
  providers: { google: boolean; emailOtp: boolean; apple: boolean };
  turnstileSiteKey: string | null;
  vapidPublicKey: string | null;
  capabilities?: { photoReading: boolean; catalogue: boolean }; // NEW
}
```
- **Absent or false = the flow is disabled.** The client must gate camera/photo UI on `capabilities.photoReading` and catalogue search UI on `capabilities.catalogue`.
- `catalogue` is `true` now (real starter catalogue bundled).
- `photoReading` is `false` until a Workers AI vision binding exists **and** the operator sets `PHOTO_READING_ENABLED=1` (only after the 30-label benchmark passes). Never enable the camera path on binding presence alone.

## 2. `GET /api/catalogue?q=` — now returns real results
- Shape unchanged: `{ results: CatalogueProduct[] }`.
- Results are `source_listed`, `inciStatus: "partial"`, with a real barcode `identityKey`. Not clinical verification. Show provenance honestly; the user confirms INCI on Review before it is analysed.
- `q` under 2 chars → `{ results: [] }` (render the real empty state). `limit` capped server-side (≤50).

## 3. `POST /api/extract` — multipart now implemented (gated)
- `multipart/form-data` with `image` (JPEG/PNG/WebP, ≤6 MB), `method=scan|gallery`, `side=back|front`.
- Returns the existing `ExtractResponse`. On success, an `ExtractionCandidate` with `identityStatus:"unknown"`, `inciStatus:"partial"`, `brand/name/category/format: null` (**identity is never inferred from pixels**), ingredients read verbatim.
- Failures: `ExtractProblem` (`blur`/`no_text`/`not_ingredient_list`/`too_large`/`unsupported_image`).
- When `capabilities.photoReading` is false or the binding is missing → HTTP 503 with a plain message (don't call it unless the capability is on).
- `application/json` paste path is unchanged and always available.

## 4. `POST /api/shelf` — `duplicate` is now real
- Adding a product with a `draft.catalogueId` re-resolves it **server-side**; the barcode identity key comes from the server record, never the client. An unknown `catalogueId` → 422.
- Re-adding the same catalogue product returns the existing item with `duplicate: true` (no second row). Client-asserted `verified` is still rejected (422) — only the server grants verified.
