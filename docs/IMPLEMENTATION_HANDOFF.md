# Claude Code ↔ ChatGPT implementation handoff
**Version:** 8 Oct 2026. Source of truth: root `CLAUDE.md`. Read this *before changing files*.

## Branch discipline
- Claude Code starts `feat/product-ui-v1-2` from **current main after** the Cloudflare contract lands. Work locally; do not commit to `main` or overwrite infra branch.
- ChatGPT owns `infra/cloudflare-gate1`; backend, D1 schema, auth, cloud deployment config, secrets setup, backend tests, CI.
- Claude Code owns approved screens/components, brand/design tokens, styling, motion, interface-level UX, accessible flows, **pure `lib/domain` calculations and tests**, source asset treatment. It must not add Supabase, invent another DB or create a separate auth solution.
- No changes to `CLAUDE.md`, `docs/CLOUDFLARE_GATE1.md`, infra config, Drizzle schema/migrations, Better Auth server implementation or GitHub workflow except via proposed patch for review.
- Keep `next build` working. The infra branch independently adds Vinext; do not modify `next.config.ts`, `vite.config.*`, or Wrangler files.
- Merge via explicit GitHub PRs only after agreement on the integration boundary.

## UX inputs and hierarchy
User will provide **Brand Identity v4**, **MVP Prototype v1.2 (latest, corrected)**, and **MVP Component System**. These are **authoritative for presentation/interaction only**. Preserve Faculty Glyphic + Geist, colour semantics, Rota Ring, grain rules and photography specs. Implement responsive mobile-first production React; do not embed `<dc-import>`, `<sc-if>`, `image-slot` or simulation code as runtime widgets. Asset licences verified before launch.

## Start with end-to-end UI, not another product concept
Use Today · Shelf · Friends navigation; Profile behind avatar; Mix entry from landing and Shelf; /mix result and share; invite landing /i/[token]; product add/search/scan/gallery/paste/review/context; reveal; session completion/rest/recovery swap; streak/Rescue; week-7 transition; PWA install/reminders; branded claim Google first, email OTP second. Apple conditional on configured developer account—never an inert button.
All non-functional pieces have authentic loading / unknown / empty / error states, not fake successes.

## Backend contract (ChatGPT implements, Claude Code consumes)
HTTP JSON over same-origin HTTPS and cookie sessions. Payloads use stable IDs, ISO timestamps, IANA timezones, explicit confidence states. Server owns authorization and mutable private data.

`GET /api/health` — status of binding/runtime (must not expose secrets or private data).
`GET /api/me` — { userId, isAnonymous, displayName?, identityProviders[], hasRota }.
`POST /api/auth/sign-in/anonymous` and Better Auth mounted at `/api/auth/[...all]` — guest session on **first meaningful save**, Google and email OTP via client methods; no separate parallel auth.
`GET /api/shelf` — { products: ShelfProduct[] }; `POST /api/shelf` — add confirmed/partial/unknown product; `PATCH /api/shelf/:id` — correct, timing, finished; `DELETE` or mark archived.
`POST /api/extract` — photo/pasted INCI candidate with identity confidence, ingredient confidence, parsed INCI spans, normalization, source/method and errors. Does NOT save user product or return unreviewed safety verdicts.
`POST /api/mix` — two user products or evidence-backed candidate classes → versioned review verdict; unreviewed or unknown → insufficient evidence.
`POST /api/rotas` — approved 7-day plan built from user's confirmed shelf and context; `GET /api/rotas/current`, `GET /api/rotas/:id` — ordered session snapshots and explanations. Require reviewed rule versions.
`GET /api/today` — current user's skincare-day state using server IANA timezone and 04:00 rollover.
`POST /api/completions` — idempotent { rotaId, skincareDate, session: 'am'|'pm'|'rest', idempotencyKey } → authoritative completion and derived streak status.
`POST /api/rotas/:id/rescue` — idempotent { missedSkincareDate, idempotencyKey }, 48h eligibility enforced by server, distinct rescued marker, earned count unchanged.
`POST /api/rotas/:id/swap-recovery` — snapshot-aware replacement, not automatic doubling.
`POST /api/rotas/:id/reflect` — { feeling: 'calm'|'bit_irritated'|'very_irritated' }, idempotent; `POST /api/rotas/next` archives once.
`POST /api/invites` — reusable opaque inviter token; `GET /i/[token]` public landing with safe display name; `POST /api/invites/:token/accept` — pair with current authenticated guest/user; no product disclosure.
`GET /api/friends` — safe pair summaries (display name, qualifying completion, pair streak); `POST /api/friends/:id/nudge` is unnecessary for V1: open WhatsApp share locally using copy text, never assume user's contacts.
`POST /api/share` — privacy-safe share artifact/link; default identity/product names off; Mix can retain verified **active classes**, not guessed brands.
`GET/PUT /api/reminders` — notification times, timezone, consent, push subscription (only after explicit permission and supported platform).
`POST /api/account/merge` — server-controlled process after **proof of both identities**, idempotent and transactional. Don't expose a public arbitrary-user merge route. Integration mechanism may be auth callback rather than direct UI endpoint.

### Types and state boundary
`ProductConfidence = 'verified'|'user_confirmed'|'partial'|'unknown'|'corrected'` is an **evidence dimension**, not a guarantee of safety.
Separate identityStatus from inciStatus; ingredient corrections stay local/provisional.
`MixVerdict = 'fine_together'|'better_separated'|'alternate_days'|'professional_check'|'insufficient_evidence'`.
`DayStatus = 'future'|'in_progress'|'complete'|'missed'|'rescued'|'rest_complete'`.
`UserSkincareDate` is a plain YYYY-MM-DD plus IANA TZ and 04:00 rollover, not UTC calendar date.
`Rota` and `DayRecord` immutable stable IDs; `ShareCard` always contains a target/deep link and a preview before posting.

### Error and placeholder policy
During parallel work, Claude Code may use a typed `MockRotaRepository` ***only for local development or Storybook-style previews*** behind a clear explicit `DEMO_MODE` flag. Never claim real invites, real OCR, real login, real pairing or production safety when using fixture data. Mock components should accept injected services via props/context, not import localStorage directly.
A failed API request must show a real retry/error state; don't silently replace it with mock data in deployed builds.
Do not expand clinical content from the sample code. Unknown product rules return `insufficient_evidence`.

## Detailed acceptance requirements
Review all **13 test scenarios** and 30-label benchmark in `CLAUDE.md`. UI must include explicit states for:
- unreadable scan / retake / paste / manual unknown;
- editable ingredient chip with corrected unverified label;
- named-product safety warning only after verified SKU match, with authoritative URL;
- Rescue eligible/used/expired, missed after rollover and week-two rescue;
- complete 7/7 vs Week Ended 5/7, and week-two streak continuity;
- actual shared friend status near ring; WhatsApp recipient chooser;
- browsing on iOS while installed PWA session may differ; offer Open-from-Home-Screen education;
- guest claim prior to install but never force it;
- no product names on share unless opt-in, active classes on Mix where evidence-backed.
- correct icon sentinel adapter for missed ring segments; initials-only avatars.
- reflection persisted outcome states.

## Test commands
```bash
npm install
npm run typecheck
npm run test:benchmark
npm run build
```
Add targeted product-domain tests as needed, without altering infra ownership. Report manual/automated test evidence and screenshot parity, not declarations that something "works" unverified.

## The final handoff from Claude Code
- feature branch pushed, PR or exact commit SHA;
- list of completed screens/states with screenshots or recordings;
- any API shape mismatches (submit proposal, don't silently create competing endpoints);
- passing local tests and blocked services;
- design system source/asset provenance with missing production photography flagged.
