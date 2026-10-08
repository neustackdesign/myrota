# Paste into Claude Code — myrota UI/UX implementation in parallel with Gate 1

You are taking over **PRODUCT UI + PURE PRODUCT-DOMAIN TESTS**, while ChatGPT concurrently implements Cloudflare runtime/Better Auth/D1 on a separate GitHub branch. Read the root `CLAUDE.md`, `docs/IMPLEMENTATION_HANDOFF.md`, `docs/CLAUDE_DESIGN_V1_2.md`, `docs/INGESTION_BENCHMARK.md` and `docs/CLOUDFLARE_GATE1.md` first.

I will give you:
- myrota Brand Identity v4 (FROZEN)
- latest myrota MVP Prototype v1.2 from Claude Design
- latest MVP Component System / implementation map
- the GitHub repository `https://github.com/neustackdesign/myrota`

## Your branch and responsibility
1. Clone/pull latest main and create **`feat/product-ui-v1-2`**. Do NOT modify main.
2. ChatGPT owns **`infra/cloudflare-gate1`**, PR #1 and all auth/database/server config. DO NOT change `CLAUDE.md`, any D1/Drizzle/Better Auth/Cloudflare config, server-side API implementation or GH Actions. Raise API-contract mismatches in a separate small handoff note.
3. You own polished, responsive **production Next.js React UI**, real accessible interaction states, motion/asset handling and pure `lib/domain` logic/tests. Do not reinterpret the visual identity, add new features, or copy the Claude Design simulator's clinical rules as truth.
4. Keep native `npm run build` passing throughout. Work as a coherent end-to-end pass, not cosmetic piecemeal changes. End with a pushed branch and PR; do not merge until Gate 1 integration.

## Required implementation surfaces
- Landing (human-image slot and Mix CTA); no signup before value.
- Shelf entry: Scan, Search, Paste INCI, Gallery; editable Review of product name/category/format/ingredient chips; distinct independent identity/INCI confidence, label-declared SafetyFlag, independently documented verified product regulator alert, unknown and partial states; manual fallback; correct retake/error/empty/loading.
- Contextual questions only when relevant; defer/decline option. Never infer pregnancy or prescription context.
- Rota Reveal: complete 7-day ordered AM/PM/rest cadence, simple explanation, up to 3 Shelf Check findings, Share my rota, start.
- Today: Rota Ring, tappable seven-day strip, AM/PM sessions (one session action each), explicit Rest Day, warm morning/cool PM, recovery substitution, streak and missing/eligible/expired/used Rescue states, paired friend adherence beside ring, sticky action.
- Shelf: detailed product state, corrected INCI and product editing/finished, Shelf Check, safety notices and Mix entry.
- /mix: pick/search/scan two products, evidence-bound verdict, reason, share, build rota with chosen products carried forward.
- Friends: opaque reusable token, name prompt for guest, WhatsApp invite, incoming link for new or existing user, own rota (1 product sufficient), real pair-ready UI, WhatsApp nudge (select recipient), Friend Streak states and invited/new-join moment.
- Week end: 7/7 milestone celebration versus partial Week Ended, optional reflection, same Shelf next week without auto-escalation.
- Share cards: Rota, Mix, Day3, Day7, Friend Streak; 9:16, square and OG-ready visual compositions; product names off by default, verified active classes on Mix retained for meaningfulness.
- Account claim: Google CTA first, 6-digit email OTP second; Apple only if service configured; guest never blocked from value; install sheets iOS vs Android; reminder permission after value; PWA/Safari divergence explained.

## Design and production quality
- Use Brand v4 selected wordmark, Faculty Glyphic / Geist / Geist Mono, semantic palette, grain sparingly (text always plated), marker system, AM/PM mapping and non-monotonic Rota Ring segments.
- Real-skin photography must be licensed or supplied; build high-quality image slots with aspect/crop direction, explicitly mark missing final assets; do NOT use unlicensed copied competitor images.
- Unknown status neutral/Sienna on ALL surfaces including chips and modal headers. Initials-only avatar until identity established. Distinguish past complete vs future vs missed vs rescued. Support RotaRing sentinel x in visual translation only, not domain truth.
- Responsive mobile web from 320px through tablet/desktop; 44px+ controls, keyboard navigation, WCAG contrast and reduced-motion fallback.

## Product correctness and tests
Build or fix pure domain functions with 13 cases from `CLAUDE.md`. Critical:
- `corrected` INCI state no crash/no false verified promotion.
- 7→next-week archives prior records exactly once and doesn't reset earned streak.
- Mix reveal explanation is derived from actual rule verdict; unreviewed pair = insufficient evidence.
- Rescue persists across time/rota boundary until 48h after missed-day end at next 04:00, then explicit expiry. Preserves continuity without rewarding an earned day.
- Real completion under each user's timezone + 04:00 day boundary; no UTC/day conflation.
- Regulatory *product* alerts only verified SKU/variant with actual notice; a photographed name is not sufficient.
- Streak history includes Rest without fabricating a product session; swapped Recovery is distinct from missed/Rescue.
- Friend Streak requires both users completing their own scheduled days; preserves privacy.
- Weekly reflection saved by rota; no automatic retinoid frequency increase.
- Account merge is ChatGPT's BACKEND RESPONSIBILITY; UI must show accurate progress/recovery/error and never wipe guest state or pretend claiming succeeded.

## Integration discipline
Define components against `docs/IMPLEMENTATION_HANDOFF.md` typed HTTP surfaces. Inject a `RotaRepository` and API adapter; demos/stories may use explicit `DEMO_MODE` stub but production must fail clearly if service unavailable. **Never silently fall back to localStorage in production.**
Do NOT:
- add another authentication SDK (Supabase, Clerk, Firebase);
- configure Neon/Vercel as an alternate deployment;
- copy unreviewed skincare advice into rules;
- move D1/BetterAuth implementation to another branch;
- mark a simulated invite/scan/account claim as operational.

## Proof and completion
- Provide screenshots/recordings of organic activation, Mix→rota, missed/Rescue→continuity, invitee→pair, Day7→week2, and claim/PWA states.
- Run `npm install`, `npm run typecheck`, `npm run test:benchmark`, `npm run build`; include new test command results and any unresolved warnings.
- Produce an asset manifest with exact filenames, image rights and missing photo/copy needs.
- Push your branch, open a PR to main, give the PR URL, describe exact unfinished API dependencies and which screens use fixture data.
- Do not merge PR until ChatGPT's infra branch has independently passed Gate 1 and integration tests have run.

**Immediate first task:** inspect the attached newest prototype and Component System and map exact screens/states/assets to production routes/components. Implement the full UI pass on your feature branch, not another plan. If there's a genuine ambiguity, make the smallest evidence-backed decision and document it.
