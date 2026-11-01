# Prototype v1.6 → production matrix

Branch `claude/focused-cray-sahnof` · draft PR [neustackdesign/myrota#6](https://github.com/neustackdesign/myrota/pull/6) · 9 Oct 2026.

Every one of the 65 built-in prototype review states (7 journeys), plus the additional states found in the markup. Source: `myrota Prototype (1).html` (DCLogic `J()` manifest). Design-state screenshots: `docs/screenshots/v1.6-states/<journey>.<step>.jpg`, rendered from the same generated screens the production app uses, driven by the demo-only prototype logic at `/dev/states`.

## Status key

| Status | Meaning |
|---|---|
| **LIVE** | Reachable in `/app`. Driven by the real Worker + D1 API and `lib/domain`. Covered by the local real-backend E2E (`docs/screenshots/local-real-backend-e2e/results.json`). |
| **LIVE·UI** | Reachable and functional. The data is real, but the step has no dedicated E2E assertion yet (visual/manual). |
| **GATED** | The screen or control is reachable, but the action is replaced by honest copy because the deployed Worker has no endpoint. Nothing is simulated or saved. |
| **DEMO** | Design-review only: kept out of the production bundle and rendered only by `/dev/states` (DEMO builds). |
| **DIFF** | Behaviour deliberately differs from the prototype; see `docs/DESIGN_DIFF_AND_CONTRACT.md`. |

Routes: `/app` is one client shell. Sub-paths are URL-synced: `/app/build`, `/app/build/context`, `/app/build/progress`, `/app/rota`, `/app/today`, `/app/today/done`, `/app/shelf`, `/app/friends`, `/app/mix`, `/app/mix/result`, `/app/add/scan`, `/app/add/review`, `/app/week/complete`. The old v1.2 paths (`/today`, `/build`, `/mix`, `/i/:token`, …) redirect to `/app/…`.

## Journey 1 · Understand · add any product (12)

| # | State | Screen / sheet | Production | Data / API | Persistence | Empty · loading · error | Acceptance |
|---|---|---|---|---|---|---|---|
| 1.01 | Landing | welcome | LIVE | `GET /api/me`, `/api/config` (no session created on view) | none | boot loader; unreachable API → branded error + retry | E2E "fresh guest sees Welcome" |
| 1.02 | Add: four ways in | add | LIVE·UI | search → shelf duplicates only (catalogue empty); paste → `/api/extract`; scan/gallery → GATED scan screen | — | empty list; toast on failure | E2E steps 02–08 |
| 1.03 | Camera permission | scan (perm) | GATED | photo reading off (`/api/extract` multipart = 501) | none | copy: "Label photos are coming soon", buttons → Paste / Add by name | visual |
| 1.04 | Glare, retake | scan (glare) | DEMO | requires real OCR | — | — | 30-label gate (Gate 2) |
| 1.05 | Review · verified | review | DEMO | server refuses client-asserted `verified`; no verified catalogue | — | — | n/a until catalogue provenance |
| 1.06 | Review · label flag | review (flag) | DEMO | editorial fixture (`[pharmacist]`, `[date]`); no reviewed SafetyFlag rules | — | — | never shown live until reviewed rule + attribution |
| 1.07 | Review · regulator alert | review (flag) | DEMO | fixture regulator notice; needs verified SKU + variant + notice URL | — | — | never shown live |
| 1.08 | Review · partly read | review | LIVE (paste) | `POST /api/extract {method:"paste"}` → candidate `partial` | on add, `inciStatus` stays `partial`/`corrected` | toast for `no_text`/`too_large` | E2E 04–06 |
| 1.09 | Correct an ingredient | review + chip | LIVE | corrections stored as `status:"corrected"`; product `inciStatus:"corrected"` | `POST /api/shelf` | — | E2E: "pasted + corrected stays unverified" |
| 1.10 | Paste ingredients | add + paste | LIVE | `/api/extract` | — | toast for problems | E2E 04 |
| 1.11 | Duplicate | add | LIVE·UI | typed name matches the existing shelf → "On shelf"; the server does not dedupe yet | — | — | E2E "duplicate shows On shelf" |
| 1.12 | Unknown product | add + unknown | LIVE | `POST /api/shelf` (`identity/inci: unknown`, placement am/pm/none) | D1 `shelf_items` | toast; Turnstile errors visible above the sheet | E2E product 1 + 3 |

## Journey 2 · Plan · week and Shelf Check (8)

| # | State | Screen / sheet | Production | Data / API | Persistence | Notes | Acceptance |
|---|---|---|---|---|---|---|---|
| 2.01 | Context questions | context | LIVE·UI | asked only when `contextNeeds()` finds evidence-backed actives (none from paste in the pilot) | answers sent once in `POST /api/rotas`, never stored | private by design | unit (domain) |
| 2.02 | New to retinoids | reveal | DIFF | no reviewed timing rules → actives held, so no retinoid nights exist | — | honest note in Shelf Check | — |
| 2.03 | Prescription treatment | reveal | DIFF | no reviewed context-hold rules; actives held anyway | — | — | — |
| 2.04 | Building | building | LIVE | animation runs alongside the real `POST /api/rotas`; on failure → back to add + toast | `rota_snapshots` | — | E2E 10 |
| 2.05 | Rota reveal | reveal | LIVE | real `RotaSnapshot`: Daily/Rest days, user-placed unknowns, `shelfCheck` notes | D1 | — | E2E 11 |
| 2.06 | Share my rota | reveal + share | LIVE·UI | client card; names OFF by default; WhatsApp with real `/app` URL; "Copy message" instead of an image | none | image cards GATED | visual |
| 2.07 | Shelf with safety flag | shelf | LIVE (no flags) | rows from real shelf; flags render only if the server ever returns reviewed flags | — | — | E2E 16 |
| 2.08 | Product detail | shelf + product | LIVE·UI | placement `PATCH /api/shelf/:id`, finish `PATCH {finished}`, remove `DELETE` | D1 | "This week's rota stays as it is" (no rebuild endpoint) | manual |

## Journey 3 · Do · today, rest, Rescue (12)

| # | State | Production | Data | Notes |
|---|---|---|---|---|
| 3.01 | Morning, paired | LIVE (unpaired) | `GET /api/today` + `buildTodayView`; `POST /api/completions` then read-back | pairing GATED: no partner avatar is shown |
| 3.02 | Evening atmosphere | LIVE | `atmosphere` from 17:00 to 04:00 user-local | E2E ran at 01:30 Lagos time and correctly used the previous skincare day |
| 3.03 | Swap to recovery | GATED | no swap endpoint | the "Swap" control is hidden (`curSwap=false`) |
| 3.04 | Day sheet | LIVE·UI | from the rota | — |
| 3.05 | Rest day check-in | LIVE | `session:"rest"` on days with no sessions | domain-tested |
| 3.06 | Late night boundary | LIVE | `lateNight` banner "counts for X until 4am" | E2E 12 |
| 3.07 | Yesterday missed | LIVE + DIFF | miss computed by the domain | banner: "Rescue isn't switched on in this pilot yet" (no action) |
| 3.08 | Rescue offer | DEMO | no rescue endpoint | sheet never opened in production |
| 3.09 | Rescued | DEMO | — | — |
| 3.10 | Day 7 missed, still rescuable | DIFF | domain still tracks eligibility; no action is offered | — |
| 3.11 | Miss pending, streak held | LIVE | `streak.state==="at_risk"` → "Streak at risk" | domain scenario 4 |
| 3.12 | Second miss, no Rescue | LIVE | `unrescuable` banner: "Your streak restarts today" | — |

## Journey 4 · Continue · day 7 and week 2 (7)

| # | State | Production | Notes |
|---|---|---|---|
| 4.01 | First day celebration | LIVE | when the day completes and `streak.earned===1` |
| 4.02 | Day 3 celebration | LIVE | `earned===3` → "Share your 3-day streak" (client share) |
| 4.03 | Rota complete | LIVE·UI | when day 7 completes or the week closes; `rcFull` only on 7 **earned** days |
| 4.04 | Week ended · N of 7 | LIVE·UI | `weekSummary.followed`; rescued days are never called completed |
| 4.05 | Weekly reflection | GATED | choice shown with the note "Reflections aren't saved in this pilot yet" |
| 4.06 | Share my week | LIVE·UI | client card, real URL |
| 4.07 | Next week from the same shelf | DEMO / GATED | "Week 2 is coming soon"; no `/api/rotas/next` |

## Journey 5 · Spread · friends (10)

| # | State | Production | Notes |
|---|---|---|---|
| 5.01 | Name before inviting | LIVE (as a profile name) | `PATCH /api/me {displayName}`; copy changed: no invite promise |
| 5.02 | Reusable invite | GATED | sheet shares the real `/app` URL ("Share myrota"), never a token |
| 5.03 | WhatsApp message | DEMO | — |
| 5.04 | Invite landing · new | DEMO | `/app/i/:token` → welcome + toast "Invites aren't switched on" |
| 5.05 | Invite landing · existing user | DEMO | same |
| 5.06 | Rota from one product | LIVE | one product is enough to build |
| 5.07 | Inviter: Tobi joined | DEMO | fixture person; not in the production bundle |
| 5.08 | Paired on Today | GATED | no partner shown |
| 5.09 | WhatsApp nudge | DEMO | — |
| 5.10 | Share Friend Streak | DEMO | — |

## Journey 6 · Spread · Mix Check (7)

| # | State | Production | Notes |
|---|---|---|---|
| 6.01 | Mix Check | LIVE | `/app/mix`; landing deep link `?a=&b=` pre-fills unanalysed names |
| 6.02 | Pick or scan | LIVE (pick) / GATED (scan) | picks from the real shelf or an unknown name |
| 6.03 | Verdict · alternate days | DEMO | needs a reviewed pair rule |
| 6.04 | Verdict · not enough evidence | LIVE | `POST /api/mix` → `insufficient_evidence` (E2E 19) |
| 6.05 | Verdict · check with a professional | DEMO | needs reviewed SafetyFlag |
| 6.06 | Share the answer | LIVE·UI | active classes only; names OFF by default |
| 6.07 | Builder with context | LIVE·UI | "Build a rota with these" → builder, carrying the Mix note |

## Journey 7 · Install, reminders, account (9)

| # | State | Production | Notes |
|---|---|---|---|
| 7.01 | Install · iPhone | LIVE·UI | steps; no "save your streak first" step (claim is off); warns about Safari ↔ Home Screen session divergence |
| 7.02 | Install · Android | LIVE·UI | uses `beforeinstallprompt` when available, otherwise honest instructions |
| 7.03 | Reminder times | DEMO / GATED | no push backend; Profile shows "Reminders · Not in this pilot yet" |
| 7.04 | Permission | DEMO | the fake OS dialog is never shown; no permission is requested |
| 7.05 | Lock screen | DEMO | no notification is delivered |
| 7.06 | Save your streak | GATED | `/api/config` providers all false; the Worker returns 501 for claim POSTs |
| 7.07 | Email + display name | GATED | — |
| 7.08 | Verify code | GATED | — |
| 7.09 | Saved · Profile | LIVE (guest profile) | name, rota day, App row; "Account · Not available yet" |

## Additional states found in the markup (beyond the 65)

| State | Production |
|---|---|
| `week` sheet (This week, any day) | LIVE·UI |
| `notes` sheet (Shelf Check, ≤3) | LIVE |
| `avatar` sheet (look builder) | LIVE·UI. Look is cosmetic and saved on this device only (`myrota.look.v1`) |
| `mixPick` unknown row "Use “X”" | LIVE |
| scan `proc` (reading) stage | DEMO |
| review `askFront` + "Snap the front" | LIVE (typing); snap shows "Photo reading is coming soon" |
| toast, sheet scrim, push/pop transitions | LIVE (reduced motion respected) |
| **production-only:** boot loader, API-unreachable error + retry, "Saving…" busy states, 401 → session-ended message | LIVE |
| v1.2 behaviour not in v1.6 (preserved): ingredient-correction provenance, private-context transient handling, 04:00 day, earned vs rescued, Rest check-in, Mix "insufficient evidence" default | LIVE via `lib/domain` |
| v1.2 screens not reproduced in v1.6 (removed, kept on PR #2/#4 branches): `/dev/states` component gallery v1.2, reminders form, claim-status polling | GATED/DEMO as above |
