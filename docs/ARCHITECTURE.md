# Architecture

## Principle

Move fast on the PWA without making the future native app a rewrite of the product brain.

```
PRODUCT DATA
    ↓
RULE ENGINE
    ↓
ROTA ENGINE
    ↓
BEHAVIOUR / STREAK ENGINE
    ↓
platform adapters
    ├── Next.js PWA
    ├── Expo / iOS
    └── Expo / Android
```

## Domain

`lib/domain` must stay pure TypeScript.

It owns:
- Product
- ActiveClass
- Rule
- relationship evaluation
- Rota
- RotaDay / Session
- shelf observations
- streak / rescue calculation

It must not know about:
- React
- Next.js
- LocalStorage
- cookies
- Supabase
- Web Push
- Vercel

## Persistence

Current:
- `lib/client/storage.ts` is temporary browser persistence.

Target:
- repository interface
- Supabase implementation
- local fallback implementation for development/tests

Supabase target state:
- anonymous authenticated user
- cookie-backed session
- shelf and rota persisted server-side
- account claim upgrades same user
- RLS on every exposed table

## Product-data model

Production catalogue records should eventually include:

```
source
source_product_id
brand
name
inci_raw
inci_parsed
active_classes[]
format
confidence
status
confirmations
last_verified
```

Status progression:

```
imported → user_confirmed → verified
```

A user correction updates their own copy first; it does not silently poison the shared canonical product.

## Rules

Rules need precedence as the engine matures:

```
product-specific
> formulation / recognised combo
> format
> active-class
> generic default
```

Production rule metadata should eventually include:

```
rule_id
class_a
class_b
relationship
reason
applies_to
evidence_level
source_refs[]
reviewed_by_role
reviewed_at
version
status
explanation_short
explanation_long
```

## Unknown states

Unknown is a first-class state.

Suggested product confidence:
- verified
- confirmed
- partial
- unknown

No detected active does not mean no active exists.

## Sharing/privacy boundary

Never put private contextual flags in:
- OG images
- invite URLs
- share cards
- public payloads
- friend-streak shared state

Shared state should be limited to safe behavioural metadata.

## Native path

If PWA retention + invite loop works:

1. move `lib/domain` into a workspace package
2. create Expo app
3. reuse API contracts and Supabase backend
4. implement native notifications/widgets where they materially improve adherence

Do not prematurely introduce a monorepo before the PWA proves itself.
