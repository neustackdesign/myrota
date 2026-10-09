# Myrota product capture integration — client contract and QA handoff

**Branch:** `feat/product-entry-integration` (draft PR #8; base PR #6 / `claude/focused-cray-sahnof`).  
**Backend owner:** CC on an isolated backend branch from `feat/pilot-backend-d1`.  
**Status:** Frontend compiled and domain regressions passed; backend catalogue and OCR still unimplemented in production. Do not advertise scan or product search as available until independently tested.

## Exact protocol

The frontend consumes **only server-reported capabilities** from `GET /api/config`:

```json
{
  "providers": {"google": false, "emailOtp": false, "apple": false},
  "turnstileSiteKey": "<public site key or null>",
  "vapidPublicKey": null,
  "capabilities": {"photoReading": false, "catalogue": false}
}
```

- `capabilities` is optional for old Workers. Absence means OFF. The backend must enforce feature gates independently of client-provided fields.
- `GET /api/catalogue?q=<trimmed query>` returns `{results: CatalogueProduct[]}` with stable `catalogueId`; debounce is 320ms and stale results are discarded on client navigation.
- `POST /api/extract` sends multipart/form-data with `method` = `scan` or `gallery`, `side` = `back`, and binary `image`; response matches existing `ExtractResponse` (candidate or classified problem). The client allows JPEG/PNG/WebP up to 8 MB. The backend must check real bytes, image dimension/type, body size and timeouts regardless.
- Capturing a photo **never saves anything**. The existing Review screen collects edits, category, format and placement before `POST /api/shelf`.
- `POST /api/shelf` carries `catalogueId` or `extractionId` for provenance. The backend MUST validate them rather than trusting client assertions. `identityStatus` of a user-selected catalogue record is `user_confirmed`, ingredients `partial/unknown`, activeClass null and flags false unless server evidence/rules validate. Unit tests enforce the frontend half.

## Actual user experience

1. Feature OFF: visible primary action is working ingredient-paste entry; product-name entry remains available. No dead-end scan CTA.
2. Photo ON: camera button and gallery picker appear. Files are bounded and sent to Worker; errors are reported without losing the underlying Shelf; user reviews the candidate before save.
3. Catalogue ON: product-name search returns real brand/product listings. Users choose one, select morning/evening/not-yet, and it goes into the existing Shelf repository; an unavailable catalogue still permits adding unknown products.
4. Rota / Mix / Today remain the same proven domain engine. A product's mere appearance in an external catalogue does NOT create a clinical verdict.

## Release gates

- Real camera/gallery on physical iPhone/Android (permissions, orientation, oversized file, blur, low light, cancellation, review, retry).
- Browser-backed protected Vercel Preview → same-origin Worker auth → D1 save/reload, no fallback fixtures.
- Staging Worker D1 separate from the existing production D1. Do not repoint the user-approved production Worker until real 30-label benchmark gates pass.
- Full existing auth/Shelf/Rota/Today regression tests plus user isolation and confirmation/source provenance tests.
- Exact preview hostname authorised in Better Auth/Turnstile; shareable access tested.
- Human clinical rule review required before promoting ingredient pairing/treatment claims.

## Scope boundaries

No real OCR models, catalogue data, D1 migrations or Cloudflare deployment are included in this frontend branch. Those belong to the backend CC workstream; do not claim a production feature is shipped based on frontend CI alone.
