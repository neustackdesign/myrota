# UI v1.2 handoff — `feat/product-ui-v1-2` (Claude Code)

Status 8 Oct 2026. Companion to `docs/IMPLEMENTATION_HANDOFF.md`. This branch touches only UI, design tokens, assets, pure `lib/domain`, the UI-side API adapter and tests. It does **not** touch `CLAUDE.md`, Cloudflare, D1, Drizzle, Better Auth, server routes or CI.

## 1. How to run

```bash
npm install
npm run typecheck
npm run test:domain      # 18 pure-domain scenario tests (new)
npm run test:benchmark   # existing 30-label evaluator tests
npm run build            # production: HTTP repository only, no fixtures
NEXT_PUBLIC_MYROTA_DEMO=1 npm run build && npx next start   # demo: in-memory fixtures + /dev/states
```

Demo scenarios: append `?demo=<id>` on first load (also switchable from the demo bar): `fresh`, `today-am`, `today-pm`, `late-night`, `missed`, `rescued`, `missed-last-week`, `second-miss`, `rest-day`, `week-complete`, `week-ended`, `friend-joined`, `flagged-shelf`. Demo scan cases: `/add/scan?case=verified|flag|alert|partial`.

## 2. Production vs demo (no silent fallback)

- `lib/client/runtime.tsx`: `DEMO_MODE` is true **only** when `NEXT_PUBLIC_MYROTA_DEMO=1` is set at build time. Otherwise every screen uses `createHttpRepository()` (`lib/api/http-repository.ts`), and a failed request shows a real error with retry. There is no fixture or localStorage fallback.
- **Infra ask:** set `NEXT_PUBLIC_MYROTA_DEMO=0` in the production and Cloudflare build environment. Next only inlines `NEXT_PUBLIC_*` values that are defined. With `=0` the demo modules are dead-code-eliminated (verified: 0 chunks contain fixture strings). If the variable is unset, the demo module is bundled but never evaluated.
- Demo mode shows a permanent "DEMO DATA" bar. The demo repository is in memory only. Its rules have status `demo_fixture` and no reviewer, so production code ignores them. Account claim **always fails honestly** in demo ("isn't connected in demo mode"); it never pretends to succeed.
- The only browser storage is `myrota.private-context.v1`, which holds the private context answers (pregnancy, prescription, retinoid experience). They are **device-local by design** (CLAUDE.md: safety context stays on the device and is never merged or shared). They are sent transiently with `POST /api/rotas` and `/api/rotas/next`, so the server **must not persist them**.

**Screens on fixture data:** in demo mode, all of them. In production builds, none; every screen reads the HTTP API.

## 3. API dependencies used by the UI

All requests are same-origin and cookie-based, and never send a user ID. The first write calls `ensureSession()` → `POST /api/auth/sign-in/anonymous` (with an `x-captcha-response` Turnstile token when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set). Before a session exists, reads of shelf, today and friends return empty instead of an error.

| UI need | Endpoint | In handoff? |
|---|---|---|
| Who am I | `GET /api/me` | yes |
| Shelf CRUD | `GET/POST /api/shelf`, `PATCH/DELETE /api/shelf/:id` | yes. **Shape:** POST body `{ draft: ProductDraft }` → `{ product, duplicate }`; PATCH supports `ingredientCorrections[{ingredientId, text \| null}]`, `placement`, `finished` |
| Extract | `POST /api/extract` (JSON for paste; multipart `method, side, image` for photos) | yes. **Shape:** `{ ok: true, candidate } \| { ok: false, problem: glare\|blur\|no_text\|not_ingredient_list\|too_large\|unsupported_image }` |
| Mix | `POST /api/mix` `{ a, b: MixSubjectRef }` → `{ result: MixResult, names }` | yes. `MixSubjectRef` = shelf / catalogue / unknown name |
| Rota | `POST /api/rotas` `{ context, idempotencyKey, mixPair? }` → `{ rota, mixNote? }`; `GET /api/rotas/current` | yes. `mixNote` should come from domain `mixNoteForRota` |
| Today | `GET /api/today` → `{ serverNow, timeZone, rota, rotas[current+previous], records, friends }` | yes. **Shape:** raw dated data; the UI derives everything with `buildTodayView` |
| Completion | `POST /api/completions` → `{ record }` | yes |
| Rescue | `POST /api/rotas/:id/rescue` → `{ record, rota }` | yes |
| Swap | `POST /api/rotas/:id/swap-recovery` `{ skincareDate, idempotencyKey }` → `{ rota }` | yes |
| Reflect / next | `POST /api/rotas/:id/reflect` → `{ rota }`; `POST /api/rotas/next` `{ idempotencyKey, context }` | yes |
| Invites | `POST /api/invites` → `{ token, url }`; `POST /api/invites/:token/accept` → `{ friend, alreadyPaired }` | yes |
| Friends | `GET /api/friends` → `{ friends: FriendSummary[], inviteToken }` | yes |
| Share | `POST /api/share` `{ card }` → `{ url, imageUrl \| null }` | yes |
| Reminders | `GET/PUT /api/reminders` | yes |
| Claim | Better Auth: `POST /api/auth/sign-in/social {provider:"google", callbackURL}`, `/api/auth/email-otp/send-verification-otp`, `/api/auth/sign-in/email-otp` | yes (standard plugin routes) |

### PROPOSED (missing from the handoff; please accept, rename or reject; the UI already calls them)

1. `GET /api/config` → `{ providers: { google, emailOtp, apple }, turnstileSiteKey, vapidPublicKey }`. Hides Apple until it is configured (no inert button) and supplies the VAPID key.
2. `GET /api/catalogue?q=` → `{ results: CatalogueProduct[] }`. The handoff names "Search" but has no search endpoint.
3. `GET /api/invites/:token` → `{ status: active|expired|not_found, inviterDisplayName, inviterStreak }`. Public, safe fields only, for `/i/[token]` and OG.
4. `POST /api/rotas/:id/rescue/decline` `{ missedSkincareDate, idempotencyKey }`. "Let it go" ends the streak hold before the 48h expiry.
5. `PATCH /api/me` `{ displayName }`. The display-name prompt before inviting, and the name on email claim.
6. `POST /api/friends/:pairId/seen`. Clears `newlyJoined` after the inviter sees the "Tobi joined you" moment.
7. `GET /api/account/claim-status` → `{ state: none|pending|committed|failed, correlationId }`. The UI shows "Saved" **only** on `committed`; otherwise it shows progress or "Nothing was deleted" with the correlation ID.

## 4. Pure domain (`lib/domain`) — contract for backend reuse

| Module | Responsibility |
|---|---|
| `skincare-day.ts` | 04:00 user-local rollover from Intl wall-clock parts (DST and half-hour offsets safe); `skincareDayEnd`; never UTC dates |
| `records.ts` | `dayStatus`, idempotent `applyCompletion` (no retroactive completion), `listMisses` (eligible / expired / rescued / rota_rescue_used / declined), `applyRescue` (one per **missed** rota, 48h after the rollover that ends the missed day), `computeStreak` → `{continuity, earned, rescued, state, heldBy}` |
| `friend-streak.ts` | Pair-date policy: same local skincare-date label in each member's own zone; real completions only (Rescue never counts); pair "today" = min of both todays |
| `evidence.ts` | Independent identity/INCI confidence; `corrected` never becomes verified; regulator alert requires verified SKU + variant + https notice; label flag requires a read flagged ingredient |
| `mix.ts` | `evaluatePair`: only accepted-status rules with reviewers; unknown, partial or corrected products, unreviewed pairs and same product → `insufficient_evidence`; safety flag → `professional_check` |
| `scheduler.ts` | Rule-driven seven-day `buildRota`: holds products without reviewed timing rules (**production currently holds every active**), never puts unreviewed pairs on the same day, context holds only from reviewed rules plus the user's own answer, Shelf Check ≤3 facts, `applyRecoverySwap`, `mixNoteForRota` |
| `week.ts` | `summarizeWeek` (7/7 requires 7 **earned** days; rescued → "Week ended"), idempotent `startNextWeek` (refuses before the last day), `recordReflection` (never changes frequency) |
| `share.ts` | Names off by default; Mix keeps evidence-backed active classes; no private-context field exists |
| `today.ts` | `buildTodayView`: every Today state from data + now |
| `lib/ui/ring.ts` | UI adapter; the prototype's `"x"` missed sentinel exists only here |

## 5. Decisions made where the sources disagreed (smallest evidence-backed choice)

1. **Unknown = Sienna, never Lagoon.** The Component System C05 and the prototype's unknown sheet use a Lagoon outline; CLAUDE.md, the brief and the v1.2 colour roles say Sienna. I used Sienna everywhere.
2. **Rescued week ≠ Rota complete.** The prototype counts done-or-rescued as 7/7; CLAUDE.md says Rescue is not completion. A rescued week shows "Week ended · N followed".
3. **Rescue window.** CLAUDE.md's 48h after the ending rollover replaces the prototype's "yesterday only". It is measured as exact elapsed hours (scenario 5); in Lagos and Dubai, which have no DST, that is the same as Thursday 04:00 local.
4. **Streak display.** The ring centre shows **continuity**. Whenever a rescued day is in the run, "N earned · M rescued" appears under the strip and in the Rescue sheet. While a miss is still rescuable the streak is held ("at risk") and today adds nothing (prototype rule).
5. **Rest check-in** counts only on days with no scheduled sessions (one-product invitees). Swap to recovery keeps the PM session and is distinct from Rescue.
6. **Skipping the context question** stores "prefer not to say", and uses the retinoid starter bound when a retinoid is present.
7. **Apple** is not rendered at all until `/api/config` reports it and the flow is wired. There is never an inert button.
8. **Evening atmosphere** applies from 17:00 to 04:00 user-local.

## 6. Not done / needs backend or devices

- Scenario **11** (iOS Safari ↔ Home Screen continuity, links opening Safari, copied-cookie divergence) needs real devices. The UI explains the divergence in the Install sheet and asks guests to save first.
- Scenario **13** merge transaction is backend work. The UI side is the claim-status polling with honest failure.
- Share images: `imageUrl` from `/api/share` (server-rendered 9:16, square and OG) is not built; "Save image" says so.
- Web push: requests permission only after a tap; it subscribes when `vapidPublicKey` exists, and otherwise saves times and says push isn't connected.
- Final brand vectors, RotaSpot illustrations and licensed photography: see `docs/ASSET_MANIFEST.md`.
- `docs/ARCHITECTURE.md` and `docs/BUILD_PLAN.md` are infra-owned and left untouched.

## 7. Evidence

Screenshots are in `docs/screenshots/` (390×844 @2x unless noted; demo data):

| Journey | Files |
|---|---|
| Organic activation | 01 landing (+ 01b desktop), 02–05 builder (+ unknown sheet), 06 context, 07 building, 08 reveal, 09 share rota, 10 Today day 1 |
| Scan / review | 11 permission, 12 processing, 13 glare retake, 14 partial, 15–16 chip correction (corrected stays unverified), 17 flag / alert / verified |
| Today states | 20-today-* (AM, PM atmosphere, late night, missed, rescued, day-7 miss in week 2, second miss unrescuable, rest day), 21 Rescue sheets, 22 after Rescue, 23 swap, 24 day sheet, 25 nudge, 26 AM done, 27 profile, 28 at 320px, 29 tablet |
| Claim / PWA | 30 claim choose, 31 email + name, 32 honest demo failure, 33 iOS install, 34 Android install |
| Day 7 → week 2 | 40 Rota complete 7/7, 40 Week ended, 41 reflection saved, 42 share Day 7, 43 next week (finished), 44 week-2 Today |
| Invitee → pair | 50 friend joined, 51 friends list, 52 invite sheet, 53 Friend Streak share, 54 name prompt, 55 invite landing (new), 56 one product, 57 invitee reveal, 58 invitee Today paired, 59 landing (existing user) |
| Mix → rota | 60–62 pick, 63 alternate days, 64 share Mix (names off, classes kept), 65 builder carry, 66 reveal note, 67 unknown → not enough evidence, fine together |
| Shelf | 70 flags + Shelf Check, 71 unknown detail (timing), 72 correct details, 73 empty |
| Other | 80 reminders, 90 component states gallery (1280px) |
