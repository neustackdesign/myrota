# myrota — Canonical engineering contract
**Status:** Cloudflare-first architecture LOCKED · 8 October 2026
**Pilot goal:** 10 real users, target 16 October 2026; *date is conditional on passed gates, not a licence to ship inaccurate skincare advice*.

## Read order and authority
1. This file: architectural and behavioural contract.
2. `docs/CLOUDFLARE_GATE1.md`: provision/deploy checklist, pass/fail log and no-secrets rules.
3. `docs/INGESTION_BENCHMARK.md` and `scripts/evaluate-label-benchmark.mjs`: 30 real-label evidence gate.
4. Approved Brand Identity v4 + latest corrected MVP Prototype v1.2 + Component System: **visual UX authority**, after user supplies the final assets to Claude Code.
5. `docs/CLAUDE_DESIGN_V1_2.md`: locked product journeys, overrides placeholder UI.
6. Existing pure `lib/domain` contracts, but *not* unreviewed skincare facts or old streak logic.

**Do not copy the demo's healthcare guidance, sample regulator alerts, fake identity screens, or its Javascript simulated timing into production.** The legacy Supabase notes in `docs/ARCHITECTURE.md` and `docs/BUILD_PLAN.md` are superseded by the cloud-native plan; both docs must be updated.

## Decision: independent Cloudflare stack
- Cloudflare Workers: Next.js 16 app initially adapted with **Vinext**. Vinext is **beta**. Run `npx vinext check` and `npx vinext init` on the existing app; keep `npm run build` (`next build`) green. Maintain working original Next.js dev/build. Document **OpenNext** as fallback only if Vinext fails a *measured compatibility or performance check*. No premature framework rewrite.
- Dedicated **myrota** Cloudflare **D1** (SQLite) database with Drizzle ORM/migrations. Myrota is not to access ApplyOS or Fleetpass databases, Supabase Auth or storage. No secrets or IDs from other projects.
- **Better Auth v1.5+**, backed by D1; `anonymous()` at first meaningful mutation; Google OAuth first for claim; email OTP via Brevo second. Apple sign-in is FAST FOLLOW until Apple Developer account/access configured. Keep session cookies HttpOnly/Secure/SameSite and on one canonical host. Auth endpoints defended with Turnstile server verification and rate limits; protect anonymous account creation and OTP resends. No account required before seeing a rota.
- All DB operations server-side behind authenticated, ownership-checked routes. No public SQL/API keys. Friend endpoints expose only safe completion/streak data. Never use a client-supplied ownerId as authorization.
- Workers AI for extraction with a provider-neutral adapter, deterministic INCI normalisation and evidence/provenance. `R2` **only if necessary**; activation/billing verification before enabling; otherwise transient images only with explicit lifecycle.
- Queues/Cron/web-push VAPID for supported reminders. iOS requires installed Home Screen PWA to receive Web Push; Android compatible browsers may support push without install; permission only after user action.
- Separate myrota Google OAuth client and consent-screen branding; Brevo verified sending domain and email templates. Google OAuth console and transactional email provider are necessarily external.
- Future Expo/native reuses pure `lib/domain` and HTTP contracts; platform-specific auth clients and UI are separate.

## Free-tier reality and Gate 1 budget decision
Workers Free: 100k requests/day, **10 ms CPU per Worker invocation**; D1 5M rows read/day, 100k written/day, **500 MB per DB**; Workers AI **10k neurons/day**. The caps are hard: don't assert high-volume viability without measurements. If realistic SSR+auth+D1 routes breach CPU or deployment limits, obtain approval for **Workers Paid (minimum $5/month)** immediately at Gate 1, rather than mutilate architecture for a nominally free result. Do not create paid resources or put secrets in the repo without explicit user approval.
Brevo Free: 300 sends/day, including transactional; count **all** sends/resends, pre-alert around 200/day, enforce per-address/IP rate limits, Google displayed first. Do not promise the 300-email ceiling can support an arbitrary viral burst.

## Nonnegotiable product promise
**Show myrota what you already own → get an explainable seven-day routine → follow it → continue → invite someone who creates their own rota.**
- **Understand:** Scan back label, search, paste INCI, gallery; front label only when needed for identity; editable product name/type/**rinse-off vs leave-on vs unknown**/ingredient chips; confidence independent for SKU and ingredients (verified/user-confirmed/partial/unknown/corrected). ANY product may be held on user's Shelf. Unknown products must never be treated as safe or compatible. **Never default an unread/unknown scan to leave-on.**
- **Plan:** reviewed rule engine, ordered AM/PM sessions, contextual questions when relevant, Shelf Check max 3 observations, 7-day reveal, no fake confident compatibility. `/mix` public entry point returns one of Fine together, Better separated, Alternate days, Check with a professional, Not enough evidence; unreviewed rules default to **Not enough evidence**. Timing rules must express reviewer-controlled spacing/cadence (not just `maxPerWeek`) and the next rota must consider trailing treatment days from the previous rota so week boundaries cannot create an unsafe/irritating adjacency.
- **Do:** One tap per scheduled AM/PM session, no per-product checklists, explicit one-tap Rest Day when no sessions, recovery/swap, 04:00 *user-local* skincare-day rollover, no catch-up doubling; streak + Rescue derived from dated events.
- **Continue:** Day 7 separates 7/7 full adherence from partial Week Ended; retain complete event history; optional calm/irritated reflection saved by rota; week 2 continues same shelf and reviewed scheduling constraints without automatic increased treatment frequency.
- **Spread:** reusable opaque invite tokens, one-to-many invitation joins, each friend their own plan, pairwise Friend Streak from both qualifying daily adherence records, WhatsApp share and user-initiated nudge, privacy-preserving share previews and working destinations. Product names opt-in; safe reviewed active classes can appear on Mix share cards. Real friend progress on Today.
- **Identity and growth:** named guest can invite without OAuth; after value offer Google → email code; account claim never loses guest shelf or active friends; no fake Apple button if not configured.
- **UI:** Brand v4 and corrected v1.2 visuals, Today/Shelf/Friends nav; Profile behind avatar; no Feed, leaderboard, ecommerce, product scoring or native app yet. Neutral/Sienna unknown states, initials avatars, text on plated backgrounds not raw grain. Licensed/owned production photography required before public launch.

## Rescues and date correctness (LOCKED)
- Qualifying day = all actually scheduled AM/PM sessions done, OR explicit Rest check-in. Day records are immutable/idempotent and keyed by rota_id + skincare_local_date, with timezone IANA ID and 04:00 rollover calculation.
- One Rescue per *missed rota*, not per newly opened calendar week; can cover one missed skincare day. Remains actionable for **48 hours after the 04:00 rollover that ENDS the missed skincare day** (e.g. miss Monday, Monday skincare day closes Tuesday 04:00 local; Rescue expires Thursday 04:00 local), even across week boundary; explicit expiry shown. When multiple misses occur, never silently erase unresolved prior miss; show whichever is eligible and identify unrescuable misses.
- Rescue is `rescued`, NOT `completed`. Preserves streak *continuity* over a gap without incrementing the *earned-completion count*. Displayed continuity/earned stats must not conflate the two. No synthetic treatment completion. Friend Streak rule: only both users' **qualifying real completed** local days, never rescued as an earned session.
- All week archive/rollover operations idempotent and transactional where DB supports it; avoid dual `startNextWeek` / `nextDay` semantics and double archives.
- Shared streak for Lagos (+01) and Dubai (+04) uses each person's local skincare-day boundary and a deterministic pair date policy documented/tested; don't compare naive UTC date strings.

## Account claim and merge (acceptance scenario 13)
Better Auth anonymous `onLinkAccount` may delete the anonymous identity by default. **Never assume it can merge automatically with an *existing* Google account.** Prove new-provider and existing-provider scenarios independently in Gate 1 before any destructive guest deletion. If the plugin callback doesn't cover returning Google users, implement a distinct secure merge transaction after both identities have been verified, before final guest retirement.
- `shelf`: union, deduplicate by verified canonical SKU where possible, otherwise stable user-confirmed signature; retain distinct variants and all provenance; never elevate unverified ingredient confidence.
- `day records`: union by rota/date identity with duplicate idempotency, completed beats missed *only where there is a real dated completion event*; do not let a mislabeled imported record invent completion. Preserve source, timezone, rescue, and modification/audit trails.
- `streak`: recompute from merged chronological real records; never add/copy numeric counters.
- `friend pairs` and `invite links`: union, enforce pair uniqueness, disallow self-pair; migrate ownership without exposing private shelf.
- `safety context`: remains on device, never merged/shared. When a claimed account arrives on a new device, ask relevant contextual questions again before recommending treatments whose safety depends on them.
- Make merge atomic/idempotent/retry-safe and test interruption halfway through. Never delete the guest until success is verified; log correlation IDs, not sensitive content.

## Safety and regulatory integrity
- All clinical/therapeutic rules and SafetyFlags require appropriate pharmacist/dermatologist reviewer attribution, evidence refs and active version. Draft fixtures MUST NOT appear to users as confident advice.
- Distinguish **label-declared ingredient warning** from **verified product+variant regulatory alert**. Never trigger a named-product regulator alert from OCR guess or user-typed name alone; link the exact authoritative notice, obtain legal/content review. Unknown/unmatched is NOT evidence of safety. CosIng is name-normalisation, not product safety certification.
- Preserve readability and confidence scopes; reviews never silently turn identity correctness into ingredient confidence. Ask for correction or show insufficient evidence.

## 13 launch regression scenarios — tests, not checkboxes
1. User correcting all ingredient chips does not crash; `corrected` remains unverified.
2. First 7-day rota archived once when `startNextWeek`; streak/history survives.
3. Mix→rota note accurately reflects reviewed pair verdict (including compatible and insufficient).
4. A missed day remains Rescue-eligible after a later calendar rollover; no silent disappearance.
5. Rescue expires visibly after exactly 48h; no retroactive claim outside eligibility.
6. Rescue preserves continuity but never increments earned completed days.
7. Named regulatory flag requires verified product/variant identity and regulator notice; label-warning path separate.
8. Rota Ring renders future/missed/rescued distinctions (including prototype sentinel `x` only as a UI adapter).
9. Default share card names off but verified active classes/verdict remain intelligible; explicit preview.
10. 04:00 user-local rollover and session completion, including DST and UTC offsets.
11. iOS Safari↔Home Screen installed-app continuity, links opening Safari instead of app, and recovery after copied-cookie divergence; guest saved data never silently discarded.
12. Weekly reflection saved against correct immutable rota and read next week.
13. Guest→new Google/email identity and guest→**existing account with prior shelf**: deterministic atomic merge; union and dedup; real completion precedence; recomputed streak; pairs/invites preserved; safety context stays device-local.
Also verify actual paired Friend Streak across Lagos/Dubai timezones and one-product Rest cases.

**Additional integration invariants:**
- Unknown extraction format remains `unknown` until evidenced or explicitly confirmed; it is never silently promoted to leave-on.
- Cross-week treatment spacing: if a reviewed rule requires recovery days between uses, a treatment on the prior rota's final day constrains the new rota's first eligible treatment day. `maxPerWeek` alone must never be used to invent cadence.

## 30-label extraction gate
- 30 real labels from Lagos local, Dubai/imported and difficult cases; >=90% legible-active recall, >=24/30 correct identity, zero invented confident actives, zero overconfident misses, every partial/unknown recoverable. Never pass with synthetic-only benchmark fixtures.
- Record actual `ai_neurons_per_scan` (including fallback attempts), input bytes, provider/model, latency median/p95, requests, cost estimate, region, correction rate; derive practical scans/day under 10k neurons.
- Avoid storing user images in public GitHub; benchmark samples private/consented. Fleetpass Cloudflare→Groq evidence in `docs/FLEETPASS_EXTRACTION_REUSE.md` is an informed baseline, not a mandate.

## Gate plan (no phase skipping)
**Gate 1 — Foundation (NOW)**: `next build` remains green; Vinext check/init+build+Workers Free deployed (or recorded blocker); D1 Drizzle migrations; Better Auth anonymous signup, Google/OTP paths (or secret-dependent blockers explicitly reported), secure shelf write/read, test both merge paths and CPU/latency. Decide $5 at THIS gate if performance requires it.
**Gate 2 — Intelligence**: real OCR/provider benchmark; review UI; versioned rules, safety review, provenance; neuron metric and 30-label real-data PASS.
**Gate 3 — Behaviour**: all 13 regression scenarios, the two integration invariants above, and timezone/pair cases green.
**Gate 4 — Growth**: real reusable token→recipient own rota→two-sided streak; account claim, cards/share/OG, install/reminders.
**Gate 5 — Release**: visual fidelity to approved assets, provider branding, professional signoff, licensed photos, cross-device/browser tests, usage monitoring and 10-user beta.

## Working arrangements — simultaneous execution
- **Infrastructure branch**: `infra/cloudflare-gate1` owned by ChatGPT. ONLY modify backend/infra, data contracts, test harness, migrations, CI, config and infrastructure documentation. Report commits and red/green verification.
- **Design branch**: Claude Code uses `feat/product-ui-v1-2` from current `main`. ONLY implement approved UI components, screens, design tokens/motion/assets and pure platform-neutral domain functions/tests. API/repository interfaces are specified in `docs/IMPLEMENTATION_HANDOFF.md`. Never rewrite Cloudflare configuration/Auth/D1/migrations, never alter `CLAUDE.md`, and don't merge into `main` while Gate 1 is underway.
- No shared working-tree conflicts. Integration by cherry-pick/PR after Gate 1, with explicit interface tests, never force-push.

## Current status / no false claims
- Main branch is a Next.js 16 scaffold with provisional `localStorage` data; not the v1.2 product.
- No confirmed Cloudflare account/resource, D1 DB, Worker deployment, OAuth credentials or Brevo keys have been provisioned from this chat.
- No actual 30-label dataset has been run yet. CI synthetic tests validate only the evaluator itself.
- Do not announce a tested PWA until end-to-end live user persistence+invite and device verification are recorded.
