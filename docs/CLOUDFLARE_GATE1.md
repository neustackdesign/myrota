# Gate 1 — Cloudflare foundation / release record
**Target:** complete technical feasibility proof without changing ApplyOS/Fleetpass.
**Status (8 Oct 2026):** Build preflight PASS; live Cloudflare deployment/auth/database NOT provisioned. [Green CI: 37707571740](https://github.com/neustackdesign/myrota/actions/runs/37707571740).
**Owners:** ChatGPT remote GitHub infra branch; Claude Code local UI branch.

## Inputs needed from Cloudflare owner
1. Cloudflare account authenticated in a supported browser or Wrangler CLI on user's own machine. This chat has GitHub and Supabase connectors but **no Cloudflare account action**. Never paste API secrets into chat or GitHub.
2. Wrangler login: `npx wrangler login` on local trusted development machine; user completes OAuth.
3. Database created in **Western Europe**: `npx wrangler d1 create myrota --location=weur`. This is intentional for the initial Lagos + Dubai user mix: D1 has no Africa/Middle East primary location, and writes always reach the primary. Record returned UUID as environment binding in `wrangler.jsonc` / deploy config (UUID is non-secret, but do not assume one).
4. Google OAuth client dedicated to **myrota**, approved redirect URIs for workers.dev and final domain; credentials via Wrangler secrets only.
5. Better Auth secure random secret via `npx wrangler secret put BETTER_AUTH_SECRET`, separately generated; no committed values.
6. Brevo verified myrota sending domain, transactional API key secret via Wrangler. Google first, email OTP second, count resends and 200/day warning. Respect total sends across shared Brevo account.

## Gate 1 tasks in strict order
### A. Build feasibility
- From repo: `npm install`, `npm run typecheck`, `npm run build` (existing Next.js control).
- `npx vinext check` against Next.js 16; write exact output and flags.
- On infra branch run `npx vinext init`, select Workers; commit generated `vite.config.*` / `wrangler.jsonc` / scripts and lockfile.
- Run `npm run build:vinext`; test local `npm run dev:vinext`; `npx @vinext/cloudflare deploy` only after account authenticated.
- Keep `next build` and normal dev available. If Vinext fails, capture reproducible problem before evaluating Cloudflare OpenNext fallback.

### B. D1
- `npx wrangler d1 create myrota --location=weur` requires an authenticated Cloudflare account. Unique DB per app, no shared data. Do not accept auto-selected APAC merely because provisioning happened from Dubai.
- Drizzle SQLite schema + committed SQL migration. Apply migrations against local D1 first, then remote with an explicit target (never assume migrations were run).
- Test unique product IDs, shelf ownership, immutable evidence versioning, invite token uniqueness, day idempotency and auth tables.

### C. Better Auth + privacy
- Use Better Auth v1.5+ D1 support, `anonymous()`, Google and `emailOTP()`.
- Anonymous auth initiated on meaningful Shelf write, not on landing page.
- Rate-limit and Turnstile both validated server-side; do not accept merely a client-visible widget as proof.
- Test guest A → newly created Google/email account; guest B → already existing Google identity with previous Shelf. Verify merge before guest deletion.
- Ensure Google first and branded consent screen, email OTP sends/resends counted and throttled; 300/day hard Brevo allowance.
- All shelf routes validate session against server-side signed cookie; ownerId from server, never request body.

### D. Measured runtime
Measure:
- release SHA and deployed worker URL;
- compatibility report, Next build, Vinext build and bundle size;
- GET /, /build, /mix, /api/health;
- initial sign-in, authenticated shelf write/read, account claim and two identities;
- Worker CPU p50/p95/max per major route, wall latency p50/p95, D1 reads/writes by query, number of subrequests;
- guest→claimed merge recovery after interruption and duplicate submission;
- Safari→installed Home Screen→Safari session continuity and independent-link opening where device is available;
- Google OAuth consent branding.
Hard failure on deployment, authentic data loss, cross-user data reads, leaked credential, or fake success state.

## Budget decision at THIS gate
Workers Free has a 10 ms CPU limit per invocation, plus 100k daily requests and hard D1 quotas. If representative requests exceed CPU budget:
- Record the failing route and measured CPU.
- Request explicit user approval to activate **Workers Paid, minimum $5/month plus possible usage**.
- Do not over-optimise away app functionality for 10 ms; do not upgrade or activate R2/paid features silently.
- If paid is impossible, evaluate Vinext/OpenNext or a static shell + narrow API Worker for temporary build testing, and clearly mark the limitation.

## External costs/quotas
- Brevo 300 emails/day including transactional; alert at 200 sends across all relevant traffic, resends counted. Rate-limit username/email and IP. No successful-OTP response before email provider confirms acceptance.
- Workers AI 10,000 Neurons/day. Track `workers_ai_neurons` per scan, all retries and cumulative account-level usage.
- R2 setup may require billing information despite available free storage allowances; not a blocker if photos are transient.
- Avoid Apple sign-in until Apple Developer membership/config exists.

## Acceptance report template (update with evidence)
| Check | Status | Evidence |
|---|---|---|
| Next build stays working | PASS | [Gate 1 CI](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| Vinext check | PASS (94% compatibility; only App Router reactStrictMode partial) | [Gate 1 CI](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| Vinext build | PASS | [Gate 1 CI](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| Workers deployed | BLOCKED ON CLOUDFLARE ACCOUNT | URL |
| D1 SQL schema generated | PASS (two tables; unapplied) | [CI migration artifact](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| D1 created | BLOCKED ON CLOUDFLARE ACCOUNT | database UUID |
| Better Auth factory compiles | PASS (factory only; not mounted) | [Gate 1 CI](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| Pure account merge planner tests | PASS (6 synthetic tests; NOT real identity link) | [Gate 1 CI](https://github.com/neustackdesign/myrota/actions/runs/37707571740) |
| Better Auth guest → new identity | NOT RUN | live integration test |
| Better Auth guest → existing Google | NOT RUN | integration test |
| Shelf user A cannot see user B | NOT RUN | access test |
| CPU/usage measured | NOT RUN | Cloudflare dashboard |
| iOS install/browser session | DEVICE TEST REQUIRED | video/report |

## Current boundary
Build compatibility and generated SQL are verified in GitHub Actions. Neither Cloudflare Worker nor D1 has been created. The Better Auth factory is fail-closed and not mounted as an active route until database, sender, abuse validation and atomic account-merge implementation exist. The app's /api/health intentionally responds HTTP 503 with live:false. The work is not a live tested PWA yet.

## Public references (current)
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://better-auth.com/docs/plugins/anonymous
- https://better-auth.com/docs/plugins/email-otp
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
