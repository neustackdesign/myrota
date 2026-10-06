# Claude Code build contract

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

- create invite server-side
- invite has token, inviter ID, status, expiry
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
- push/reminders only after install and explicit permission
- do not block starting a streak on signup or install

### 6. Account claim

Anonymous until value.

After first completed session, test:

**Protect your streak**

- Google / Apple / email code later
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

- benchmark 100 products actually found on Lagos/Dubai shelves
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
