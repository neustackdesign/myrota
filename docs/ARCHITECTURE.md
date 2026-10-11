# Architecture — Cloudflare-native (locked 8 Oct 2026)

Canonical contract: root `CLAUDE.md`. Execution checklist: `docs/CLOUDFLARE_GATE1.md`. UI/backend integration: `docs/IMPLEMENTATION_HANDOFF.md`.

## Ownership
myrota runs independently of ApplyOS and Fleetpass. No shared Supabase, no alternative Neon path unless the Cloudflare proof fails. Domain code remains native-portable in `lib/domain`.

## Runtime
```
User browser / installed PWA
  ↓ secure same-origin cookie
Cloudflare Worker — Next.js 16 via Vinext (beta; OpenNext documented fallback)
  ├─ Better Auth v1.5+ (anonymous→Google/email OTP), sessions and cookies
  ├─ server-only API endpoints and authorization
  ├─ rule engine and domain service layer
  ├─ Drizzle → D1 myrota database
  ├─ Workers AI extraction (with evidence/provenance)
  ├─ optional transient R2 object lifecycle (requires activation)
  └─ Cron/Queues/Web Push for reminders
External: Google OAuth client and Brevo delivery.
```

No direct public database client. All shelf, friend, rota and share reads are scoped to authenticated owner/valid share token. Never store private skincare/contextual answers in public share or friend payloads.

## Auth claiming and identities
- Generate guest only at first meaningful mutation; do not block first rota reveal.
- Better Auth anonymous linking can delete anonymous users; need atomic idempotent migration of shelf/history/friends/invites before retirement.
- Claiming with a pre-existing Google identity is a distinct authenticated merge case; test how callback behaves, implement secure verified merge if necessary. For privacy, sensitive contextual flags live only on the original device; users reconfirm on new devices.
- Google preferred, email-code secondary. Do not enable unconfigured Apple or WhatsApp OTP.
- iOS PWA Safari-cookie install continuity needs real-device testing; other browser contexts may diverge.

## D1 data sketch (source of truth is migrated SQL)
Users/sessions/accounts from Better Auth schema.
Product catalogue and candidate scan records; per-user shelf item with independent identity/INCI confidence, versioned corrected tokens and provenance; reviewed clinical and regulatory evidence with reviewer/audit fields.
Rota immutable id/version and seven dated Rota Days; independently stored AM/PM/Rest completion events; Rescue records with 48h end-boundary deadline and continuity marker, not counted as an earned completion.
Rota continuation and weekly reflections; reusable inviter tokens, invitation joins and unique friend pairs; timezone-specific daily completion safe summaries.
D1 schema initially lives in `db/` and migration path; Drizzle typed access. No data from existing projects.

## Clinical evidence
OCR/model extracts candidates only. Dictionary normalisation with verbatim label spans; user confirmation does not certify safety. No unknown/unreviewed pair returns a positive verdict. Label declared warnings and independently sourced regulator alerts must never share one unverified path. Keep test fixtures from ever being presented as professionally reviewed clinical advice.

## Free-tier instrumentation
Workers Free CPU 10 ms/request is the risk; D1 limits 5M reads/day, 100k writes/day, 500MB/database; Workers AI 10k neurons/day; Brevo total 300 emails/day. Gate 1 records CPU and route timings, no assumption of high-volume sustainability. $5 Workers Paid option requires user confirmation when measured failure occurs.

## Deployment compatibility
`npm run build` (Next.js) **must** remain a passing control. Vinext `npx vinext check`, then `npx vinext init`, build/deploy through Cloudflare. OpenNext as documented fallback only with evidence. `wrangler` secrets held in Cloudflare, never in GitHub or browser code.

## Expo path
Reuse `lib/domain`, API contracts, event names and backend. Native clients implement their own UI/platform notification and authenticated HTTP session handling. Don't create monorepo prematurely.

## D1 location decision
Cloudflare currently offers no Africa or Middle East D1 primary region. For the initial Lagos + Dubai cohort, create the write primary with `--location=weur`; APAC auto-selection from a Dubai provisioning machine is not the product decision. Global read replication can later reduce read latency, but only when enabled and used through the D1 Sessions API; it does not move the write primary.
