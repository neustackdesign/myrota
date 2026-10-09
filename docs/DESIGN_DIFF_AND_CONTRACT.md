# Design diff and contract — where production deliberately differs from the sources

Rule applied throughout: **the new design owns look, copy, transitions and sheets; `lib/domain` and the deployed Worker own every calculation and trust decision.** Where the design would have shown something the pilot cannot back, the copy was changed, or the control was gated or moved to the demo gallery. Each change below is the smallest one that keeps the design intact.

## Landing (1)

| Source | Production | Why |
|---|---|---|
| FAQ "Save it with Google, Apple or an email code" | Account saving "isn't switched on in this pilot yet" | `/api/config` providers are all false; the Worker returns 501 for claim POSTs |
| FAQ "offers to add itself to your home screen so reminders can reach you" | Home screen yes; "Reminders aren't switched on" | no push backend / VAPID key |
| FAQ "one Rescue per seven-day rota: use it today…" | Rescue "is designed… still being connected"; a missed day shows as missed | no rescue endpoint |
| FAQ medical: "it holds your retinoid and exfoliant" (prescription) | strong actives are not scheduled until a pharmacist-reviewed rule exists | true of the current conservative engine |
| SA "Invite a friend on WhatsApp", message with `myrota.app/i/a8Kb4Q` | "Share myrota on WhatsApp" with this deployment's real `/app` URL; caption says Friend Streaks aren't on and the ticker is illustrative | no invite/pairing backend; fixture token removed |
| TH "a reminder only when you need it" | "Reminders are planned; they aren't switched on in this pilot yet"; slot copy "Planned: …" | no push |
| TU intro "Scan the back, search the name or paste the ingredients…" | "Paste the ingredients from the label, or add a product by name… Photo reading and product-library matching are still being built."; fragment cards carry pilot labels | `/api/extract` photo = 501; catalogue empty |
| FR verdicts (hard-coded) | kept as labelled illustrations: "These verdicts are illustrative examples, not reviewed results…"; Build CTA carries the pair as unanalysed names to `/app/mix` | brief allows labelled illustrations; app returns Not enough evidence |
| FR prescription verdict body "myrota holds your retinoid…" | "Check with a professional before combining them." | no reviewed hold rule |
| Footer `href="#"` (About, Contact, Press kit, Privacy, Terms, Cookie settings) | real pages `/about`, `/contact`, `/about#press`, `/legal/privacy`, `/legal/terms`, `/legal/privacy#cookies` | no dead links |
| Footer Instagram / TikTok / WhatsApp channel icons | removed | no such accounts exist |
| `appHref` → prototype file | `/app?src=landing` | real PWA entry |

## Prototype v1.6 → `/app`

| Source behaviour | Production | Why |
|---|---|---|
| Fake status bar, URL bar, home indicator, OS permission dialog, review side panels | not rendered | simulation furniture |
| Phone frame 395×820 | full-viewport column ≤520px, centred on wide screens with the screen's own surface colour | brief: don't inflate a phone frame; mobile-first semantics |
| Add screen: primary "Scan the label", links "Paste ingredients" / "Choose a photo", "Search brand or product" | primary "Paste ingredient list"; "Add by name instead" focuses the name field; "Photo reading coming soon"; Mix picker's scan button focuses its name field. Paste sheet: "We'll split it into lines for you to review" (not "the same way as a scan") | no photo endpoint; no dead CTAs |
| 8-product famous-brand library search | search only shows the user's own shelf (duplicate detection); unknown → "Add “X”" | catalogue has no reviewed entries |
| Scan / gallery → simulated OCR (glare, proc, verified/flag/alert reviews) | scan screen says "Label photos are coming soon" → Paste / Add by name | 30-label gate not passed; Worker returns 501 |
| Review flags (hydroquinone, regulator alert with `[pharmacist]` placeholders) | never shown live; demo gallery only | editorial fixtures |
| Pasted review → "Add to shelf" | then "Where does it go?" placement sheet; saved as `user_confirmed` name, `partial`/`corrected` INCI | pasted INCI isn't analysable, so it's placed by the user and never upgraded |
| Hard-coded retinal/BHA nights pattern | real `buildRota` with no reviewed rules → Daily/Rest days only; actives held with a Shelf Check note | conservative engine |
| `DayTag` / `RhythmStrip` types Retinoid/Exfoliant/Recovery/Rest | + **Daily** (shell `#F1E0D2`, sun icon) | a day with only basic steps isn't "recovery" |
| Streak = mutable counter | `computeStreak` continuity in the ring; celebrations use **earned** days; "Streak at risk" while a miss is pending | CLAUDE.md streak rules |
| Rescue banner → Rescue sheet → "Use my Rescue" | banner states the miss and that Rescue isn't on; no action | no endpoint |
| Swap to recovery | control hidden | no endpoint |
| Claim banner "Save it" | "Your rota lives in this browser. Saving to an account isn't switched on in this pilot yet." | claim disabled at the Worker |
| Invite card / Friends / nudge / Tobi joined / paired avatar | Friends screen explains Friend Streaks aren't on; "Share myrota" shares the real URL | no pairing backend; never show Ama/Tobi as real |
| Today avatar → Friends | avatar → **Profile** sheet | CLAUDE.md "Profile behind avatar"; Friends stays a tab |
| Reflection saves and changes next week's note | choice shown; "Reflections aren't saved in this pilot yet" | no endpoint |
| Next week / Start week 2 | "Week 2 is coming soon" | no `/api/rotas/next`; history is kept |
| Reminders + lock screen | not reachable; Profile row "Not in this pilot yet" | no push |
| Share "Save image" | "Copy message" (text + real URL); image cards say they aren't on | no `/api/share` renderer |
| Avatar look kept in state | look saved on this device only (`localStorage myrota.look.v1`, cosmetic) | no profile-look field on the server; disclosed in Privacy |
| "Ama"/"Tobi"/"Kemi"/`kemi@example.com`/`482913` fixtures | only in the demo-only module loaded by `/dev/states` | no fixture bleed (verified by bundle scan) |
| The paste binding on both the add screen and the paste sheet (prototype quirk: the sheet's "Read ingredients" reopened the sheet) | context-aware: opens the sheet, or submits when inside it | bug in source |
| Toast z-index below sheets | toast above sheets | errors raised from sheets must be visible |
| Better Auth guest name "Anonymous" | treated as no display name | it isn't a name the user chose |

## HTTP / data contract used by `/app` (unchanged Worker)

| Need | Endpoint | Shape used |
|---|---|---|
| boot | `GET /api/config`, `GET /api/me` (401 = no session yet) | `{providers, turnstileSiteKey, vapidPublicKey}`, `MeResponse` |
| session | `POST /api/auth/sign-in/anonymous` + `x-captcha-response` | on the first write only |
| shelf | `GET/POST /api/shelf`, `PATCH/DELETE /api/shelf/:id` | POST `{draft: ProductDraft}`; never `verified` from the client |
| paste | `POST /api/extract {method:"paste", side:"back", pastedText}` | `{ok, candidate}` / `{ok:false, problem}` |
| rota | `POST /api/rotas {context, idempotencyKey}` (context transient), `GET /api/rotas/current` | `{rota, mixNote}` |
| today | `GET /api/today` + header `x-myrota-time-zone` | raw dated data → `buildTodayView` (client clock, server skew-corrected) |
| completion | `POST /api/completions {rotaId, skincareDate, session, idempotencyKey}` | read back via `/api/today` before any celebration |
| mix | `POST /api/mix {a,b: MixSubjectRef}` (shelf or unknown) | `{result, names}` |
| name | `PATCH /api/me {displayName}` | `MeResponse` |

**No schema or migration changes. No Worker change.** One config change: `next.config.ts` reads an optional `MYROTA_API_ORIGIN`, for local harnesses only. Preview and Production leave it unset and proxy to `https://myrota.neustackdesign.workers.dev`.

`Permissions-Policy: camera=()` is set because photo capture is not used. Remove it when photo reading ships.
