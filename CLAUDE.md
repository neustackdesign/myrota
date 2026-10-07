# Claude Code build contract

## CURRENT RELEASE AUTHORITY — 8 October 2026

The **October 16 private 10-user pilot** is the delivery target. Read these before making product or architecture decisions:
- `docs/CLAUDE_DESIGN_V1_2.md` — frozen brand + corrected design/product contract
- `docs/INGESTION_BENCHMARK.md` — 30-real-label acceptance gate; run `scripts/evaluate-label-benchmark.mjs`
- `docs/PILOT_OCT16.md` — dated milestones and acceptance checks

**Authority order:** reviewed product and safety requirements → approved Brand v4 + Claude Design v1.2 for UI → this repo's pure domain/application contracts → existing rough UI prototype. Do not transplant illustrative clinical recommendations from the Claude Design prototype.

**One nonnegotiable differentiator:** add *any* owned product via scan, search, pasted ingredients or gallery; then confirm the extracted data. Every product can be on Shelf. Unknown ingredients must not be treated as confidently analysed. Source/provenance and uncertainty are explicit. Show **SafetyFlag** only for pharmacist/dermatologist-reviewed rule fixtures or separately sourced regulatory product alerts. A label scan cannot establish the absence of undeclared adulterants.

**Identity:** Supabase anonymous identity at first meaningful write; cookie-backed SSR; later Google/Apple/email six-digit code **in pilot**. Ask display name before guests invite. Invite link is a reusable opaque token with separate joins/pairs; a group/Status link may bring multiple users. Paired Friend Streak advances only after both members' own eligible days complete. WhatsApp-first share and a user-initiated WhatsApp nudge are launch features; bonus Rescue and push nudge are experiments/later.

**PWA:** WebKit iOS 17.2+ copies cookies on install, not IndexedDB/LocalStorage. Supabase rotated refresh tokens can still invalidate stale copied sessions. Test Safari → Home Screen app → Safari again beyond reuse leeway, plus recovery/claim UX, on real devices. Do not promise anonymous recovery without a linked credential. Android Chrome push can be browser-level where permission is supported; iOS Web Push requires Home Screen installation. Don't manufacture an "app store" CTA.

**Scheduling:** 04:00 local skincare-day rollover; rest days check in; fixed treatment plan (no missed-session doubling); one Rescue per rota, including last day; preserve streak without awarding an unearned completed day; history-aware rota edits; optional swap-to-recovery when skin feels irritated. Unknown product compatibility and missing rule default to **insufficient_evidence**, never compatible.

**Quality gates:** 30 consented Lagos/GCC/difficult label tests; >=90% legible-active recall, no unsupported confident actives, >=80% correct SKU identity and no overconfident misses. Reviewer-signed safety/therapeutic rules for clinical output. See test scripts. Until these gates pass, public claims of analysed compatibility/safety are disabled or marked unknown.

**Social artifacts:** My Rota, Mix verdict, Day 3, Day 7 and Friend Streak have share destinations and privacy previews; product names excluded by default. Friend profile shows behavioural metadata, not products/pregnancy/prescription context.

**Core flow:** Understand → Plan → Do → Continue → Spread. Week-seven? No: seven-day close → quick skin-feel reflection → next seven-day rota. Do not automatically increase retinoid dose/frequency solely from self-reported comfort.

Older "current prototype" and "next sequence" notes below describe the initial scaffold and are superseded when inconsistent with this release authority.


You are building **myrota**, a lightweight skincare routine PWA.

## Product north star

The MVP must prove one loop:

```
add what I own
→ get a useful 7-day rota
→ follow today's AM/PM plan
→ keep a streak
→ invite one friend
→ friend starts their own rota
```

Do not turn this into a generic skincare encyclopaedia, ecommerce layer, feed, community, dashboard, or AI chat product.

## Core JTBD

1. Can these products fit together?
2. When should I use what I already own?
3. What am I doing unnecessarily?
4. Can I actually stick to the routine?

## V1 behaviour

- Organic users are encouraged to add 3+ products.
- Invitees may start with 1 product.
- A rota is seven days.
- Today has **one AM completion action and one PM completion action**. Do not require ticking every product.
- Recovery nights count as following the plan.
- Missed sessions do not cascade or cause catch-up dosing.
- One **Rota Rescue** may preserve one missed day per seven-day rota.
- A friend never copies another person's routine. They build their own rota and only share accountability.
- WhatsApp is the primary invite/share path; use Web Share API where available and WhatsApp fallback.
- `/mix` is an acquisition utility, not the product identity.
- Shelf Check returns a maximum of three useful observations. No numerical score.

## Explicitly out of scope

Do not add any of these without a validated reason:

- feeds, follows, likes, comments
- public profiles/handles
- leaderboards, XP, gems, levels
- monthly calendar
- product shopping or affiliate recommendations
- routine score
- progress-photo system
- full analytics dashboard for users
- copied friend routines
- adaptive missed-night rescheduling
- native apps before the PWA loop works

## Current prototype

The repository currently contains:

- Next.js PWA shell
- 15 provisional product fixtures
- product/rule/rota types
- deterministic seven-day rota generator
- basic Mix Check
- Shelf Check
- AM/PM completion
- streak calculation
- one Rota Rescue
- share/invite surface
- browser storage adapter

The rule matrix and product fixtures are development data, **not signed-off clinical/product data**.

## Architecture constraint: native later

Assume we may build iOS/Android with Expo/React Native after proving the PWA.

Therefore:

- keep product, rule, rota, streak and shelf logic in pure TypeScript under `lib/domain`
- do not import Next.js, browser APIs, React, Supabase or UI concerns into `lib/domain`
- put persistence behind a repository/service boundary
- keep analytics event names platform-neutral
- avoid web-only domain representations

The goal is to reuse domain code and contracts, not the web UI.

## Next implementation sequence

### 1. Make the current app green

- install dependencies
- run `npm run typecheck`
- run `npm run build`
- fix every build/type error before adding features
- commit lockfile

### 2. Introduce the persistence boundary

Create a small interface, e.g.

```ts
interface RotaRepository {
  getCurrent(): Promise<AppState | null>
  saveShelf(...)
  saveRota(...)
  saveCompletion(...)
  useRescue(...)
  createInvite(...)
  acceptInvite(...)
}
```

Keep the existing browser adapter as local development fallback.

### 3. Connect Supabase

Use current Supabase docs and CLI; do not guess commands.

Target behaviour:

- anonymous auth on first meaningful write
- cookie-based SSR session
- anonymous user can later claim identity without losing data
- server persistence for shelf, rota, completions, invites and friend streak
- RLS on every exposed table
- user ownership predicates on every user-specific policy
- no service-role key in browser code
- use current publishable key, not legacy assumptions

Create migrations with `supabase migration new ...`, then apply/verify. Do not invent migration filenames manually.

Suggested entities:

- product_catalogue
- user_products
- rotas
- rota_days / or versioned JSON rota payload
- completions
- invites
- friend_streaks
- rule_versions

Keep private context such as pregnancy/Rx flags out of share payloads.

### 4. Close the real friend loop

The current invite route is visual only. Make it real:

- create reusable opaque inviter link server-side
- separate join records for each recipient; invite tokens can support WhatsApp groups and Status
- invitee can accept anonymously
- invitee adds 1+ product and creates their own rota
- friend streak links two users but never copies products or context
- each person's completion is independent
- shared state only exposes completion/streak metadata

### 5. PWA activation

Implement install UX only after the core persisted loop works.

- Android: use install prompt when available
- iOS: clear Add to Home Screen education
- install prompt belongs after rota reveal/start-streak value
- iOS: push only after Home Screen install and explicit permission; Android: test browser push after permission, installation not always required
- do not block starting a streak on signup or install

### 6. Account claim

Anonymous until value.

After first completed session, test:

**Protect your streak**

- Google / Apple / email six-digit code for pilot (optional claim after value)
- claiming must preserve same Supabase user/data
- never make account creation a precondition for seeing a rota

## Analytics events

Instrument these exact conceptual events:

- landing_viewed
- product_added
- rota_revealed
- streak_started
- session_completed
- rescue_used
- install_prompted
- app_installed
- account_claimed
- invite_sent
- invite_opened
- invite_accepted
- invitee_rota_started

Primary early funnel:

```
rota_revealed
→ streak_started
→ day_1_complete
→ invite_sent
→ invite_opened
→ invitee_rota_started
```

Do not optimise raw signup count over activated users.

## Product-data workstream

In parallel with code:

- first pass the 30-real-label extraction gate (see docs/INGESTION_BENCHMARK.md), then extend to 100 Lagos/Dubai products
- benchmark competitor recognition and advice quality
- prioritise local/grey-import products that incumbents miss
- represent product confidence explicitly
- preserve provenance
- user corrections remain user-level until corroborated/verified
- opaque/unrecognised products must remain unknown, not silently treated as harmless

## Rule governance

The domain model supports:

```
compatible | caution | alternate | avoid | insufficient_evidence
```

and reasons:

```
irritation | pregnancy | formulation | duplication | prescription | unknown
```

Every production rule eventually needs evidence/source refs and appropriate professional review. The current `DRAFT_RULES` exist only to make the prototype testable.

## Design principles

- mobile-first, thumb-friendly
- visually confident, not clinical or pharmacy-like
- plain language
- generous whitespace
- one dominant action per screen
- screenshot/share-friendly milestones
- no dark-pattern invite prompts
- no fear-based skincare copy
- make recovery feel intentional, not like failure

## Definition of MVP success

The PWA is not "done" because the screens exist.

The first meaningful proof is:

1. a user creates a rota from products they own
2. returns/completes sessions
3. sends an invite
4. the receiver starts their own rota

Measure especially:

- rota reveal → streak start
- day-1 completion
- invite send rate
- invite open rate
- invite → invitee rota start

The viral loop is only real if recipients activate.
