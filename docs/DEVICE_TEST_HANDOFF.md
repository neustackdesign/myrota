# Mobile device-test handoff — barcode pilot (staging)

Automated acceptance (below) is green on staging. The items here need **real device camera access** (one Android + one iPhone) that automation can't provide.

## Links (apply the Vercel Shareable Link first — see release report)
- Marketing: `https://myrota-bnpvadcwh-neustackdesign-gmailcoms-projects.vercel.app/`
- PWA: `https://myrota-bnpvadcwh-neustackdesign-gmailcoms-projects.vercel.app/app`
- Backend: `https://myrota-staging.neustackdesign.workers.dev` (`catalogue:true, barcodeLookup:true, photoReading:false`)

## Already verified automatically (don't re-test unless investigating)
- Manual barcode entry → exact SKU (`3606000637535` → CeraVe Baby Eczema Relief Cream), no fuzzy substitution.
- Catalogue name search, category/usage confirmation, Shelf save (server barcode key, never `verified`), duplicate prevention.
- 7-day Rota, AM/PM completion + idempotency + refresh, two-user isolation (API 18/18).

## Needs a real device (Android Chrome + iPhone Safari)
1. **Camera barcode scan** — tap "Scan"; confirm the camera permission prompt appears **only after the tap** (never on page load). Scan a real product barcode (e.g. a CeraVe/La Roche-Posay tube). Expect: exact SKU match → review category/usage → save. Deny permission once → confirm graceful fallback to manual entry.
2. **Gallery barcode scan** — choose a photo of a barcode from the library; same resolution path.
3. **Manual barcode entry** — type a GTIN; exact result.
4. **Shelf persistence** — add, then reload the tab; product remains.
5. **Rota + completion** — build a 7-day rota, mark an AM/PM session, reload; progress remains.
6. **iPhone install continuity** — Add to Home Screen; confirm the installed PWA keeps the session (links open in-app, guest data not lost).
7. **Responsive** — 390px and tablet widths; no horizontal scroll; tap targets ≥44px.

## Out of scope (feature OFF)
- **Ingredient photo reading (OCR)** is disabled (`photoReading:false`) pending the 30-label benchmark. Only *barcode* scanning is live. Do not test label-text extraction.

## Record per device
Browser + OS version, each step pass/fail, screenshots of any failure, and the camera-permission timing. Return to the backend owner for fixes.
