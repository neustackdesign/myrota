# myrota — Claude Design final correction pass (v1.2)

## Authority and constraint
Brand Identity v4 and its visual language are frozen. The current MVP prototype and component system are implementation-design bases, not authorities on medical/skincare rules. Do **one correction pass**, not another creative exploration. Output a connected prototype, updated component library and route→component→state→data→action map.

## Core promise
Add **any** skincare product, understand what can be confirmed about it, turn it into a usable seven-day plan, follow the plan, and share progress with a friend.

## Five jobs
1. **Understand** — ingestion and provenance
2. **Plan** — reviewed deterministic scheduling and Shelf Check
3. **Do** — today, completion, recovery, streak and Rescue
4. **Continue** — day-seven completion, weekly reflection and the next rota
5. **Spread** — real friend-pair accountability and shareable results

## Ingestion: full launch flow
- Add method sheet: **Scan (ingredients/back label first) · Search · Paste INCI · Gallery**; editable manual fallback.
- Camera/gallery ingestion: permission, capture, glare guidance, processing, extraction, verification, re-take and correction. Ask for the front label only when necessary for identity.
- Review: brand/name, product category, rinse-off/leave-on, verified ingredient/active chips, unknown and partially readable text, provenance state: verified/user-confirmed/partial/unknown.
- An item with unknown ingredients may be held on Shelf but must not silently enter clinically material pairing/scheduling conclusions.
- Design calm, clearly attributed **SafetyFlag** cards on Review and Shelf Check. Render solely from pharmacist/dermatologist-reviewed rules or independently sourced product alerts. A scan without flags is **not** a certification of safety. Distinguish label-declared concerns from independently documented regulatory alerts. Start with relevant explicit labels such as listed hydroquinone, corticosteroids and mercury compounds; do not imply OCR detects undeclared adulterants.
- Include product detail: remove, mark finished, correct/re-scan and change manually assigned timing. A user correction is local until corroborated.

## Plan
- Ask context only when it changes output: retinoid experience and applicable pregnancy/breastfeeding/prescription-care context; the latter must remain private and never enter public share payloads.
- Rota Reveal shows complete week, ordered AM/PM, treatment/recovery/rest days, one-line rationale, **up to three** Shelf Check observations, and **Share my rota**.
- Apply one of five distinct pair verdicts: Fine together / Better separated / Alternate days / Check with a professional / Not enough evidence.
- Unknown or unreviewed relationships **never** default to compatible.
- Mix Check is available from the landing page and Shelf, includes scan in each picker, makes the verdict the headline, and supports Share answer → viewer's own utility/rota.
- Week strip supports inspecting every day via Day sheet.

## Do
- Today presents one action per scheduled AM/PM session, not per-product checkboxes. One-product invitees may have a Rest Day; one-tap Rest check-in keeps it completable.
- Recovery/rest counts as following the schedule; never double missed actives.
- A user may elect **Swap to recovery** on an active night. Distinguish this from Rescue.
- Rota Ring = seven-day progress; centre = continuing daily streak. Paired friend's safe completion status appears near the Ring (not only Friends tab).
- Sticky completion button when long routine pushes it below the fold; proper 44px hit areas.
- Missed day, Rescue, late-night day boundary, and next-rota transitions must have distinct UX states; day-seven misses are still rescuable.
- Ordinary completion is inline. Reserve full celebrations for first day, Day 3, Day 7 and genuine friend milestones.
- PM switches the Today visual atmosphere to the approved cool/Dusk brand treatment; do not disrupt component anatomy.

## Continue
- Day 7: real **Rota Complete** celebration plus optional share artifact.
- One gentle weekly reflection: Calm / A bit irritated / Very irritated.
- Continue into next rota from the same shelf, with an option to add or mark products finished.
- Do not promise automatic treatment-frequency escalation based only on self-report; changes must respect reviewed rule bounds and user choice.

## Spread
- Design share artifacts: **My Rota · Mix verdict · Day 3 · Day 7 · Friend Streak**, in 9:16, square and OG-link-preview specifications.
- Product names and sensitive context are hidden by default. Product display is opt-in and always previewed.
- WhatsApp-first **reusable opaque invite token**; one inviter link may generate multiple joins (group chats / Status). Recipient keeps their own product/routine.
- Existing user opening invite can pair directly; new user may start with one product.
- Joint streak is based on both people's actual qualifying days, using each person's skincare-day/timezone rules.
- One-tap user-initiated **WhatsApp nudge is LAUNCH**: open the WhatsApp share/recipient chooser with prefilled non-sensitive text. Don't pretend to route directly to the friend without contact data. Push nudge is FAST FOLLOW.
- Pair state shown in Today. Inviter receives a meaningful joined/started moment, not only a toast.
- Bonus Rescues, group competitions, and multiple simultaneous friend challenges are EXPERIMENT (not a blocker).

## Identity and PWA
- Anonymous Supabase identity on first meaningful write, persisted server-side.
- Later account claim: **Google, Apple, email six-digit code**. No WhatsApp OTP, no “Get the app instead” or unfinished native store destination.
- Guests requesting to invite get a one-field **display name** prompt; email claim also offers display name. Never invent a name.
- iOS Home Screen sheet and Android install flow are different. Do not force signup before first value; strongly offer but do not force claim for cross-device recovery. Supabase-cookie session continuity must be tested on real iOS browsers/PWAs.
- Android Chrome may support browser push without an install; only request permission after a clear user action.

## Brand corrections
- Preserve Brand v4 visual identity, fonts, marker icons, colour roles and expressive textures.
- No small text over unplated grain.
- Skin-tone Rota Ring order must be non-monotonic; don't encode darker/lighter tones as superior progress.
- Unknown = neutral/Sienna, not the confident Lagoon.
- Unmatched future versus missed versus rescued segments have distinguishable appearances.
- Initials avatar before actual identity/image.
- Place real high-resolution, authentic skin photography (prominently African/darker skin) on landing/invite/milestone compositions. Define image specs and rights requirements; final licensed/commissioned photography is a **production asset dependency**, not something a visual mock alone solves.

## Deliverables
1. **myrota MVP Prototype v1.2** — connected, responsive interactive journeys: scan/search/paste→review→rota; ongoing Today; invitee (new/existing)→shared streak; Mix→share→builder; Rescue/rest/late-night; week 1→week 2; install/claim.
2. **myrota Component System v1.2** — final tokens/components/states, including AddMethodSheet, ScanCamera, ProductReview, SafetyFlag, ContextQuestion, MixVerdict, WeekDaySheet, ProductDetailSheet, RotaComplete, ShareCard, SharePreview, FriendPair, WhatsAppNudge, AuthProviders, Install.
3. **Implementation map** — route → component → state → data → action → backend dependency and label each capability **LAUNCH / FAST FOLLOW / EXPERIMENT**.

Do not invent provider APIs, medical rules, test results, screenshot photography rights, installed/native capability, or real-time backend behaviour. Preserve visually compelling execution without burying the user's primary action.
