# myrota real-data pilot — release protocol

**Baseline:** keep the approved Vercel Demo Preview intact (`NEXT_PUBLIC_MYROTA_DEMO=1`). Do not change Vercel production or `myrota-eight.vercel.app`.

## Already implemented
- Backend: D1-authenticated Shelf CRUD, real pasted INCI without fabricated identities, conservative Mix, seven-day rota snapshots and 04:00-local dated completion records; migration `0002_rota_and_day_records.sql`.
- UI: approved Brand v4 screens with same-origin `/api/*` proxy to Worker and `NEXT_PUBLIC_MYROTA_DEMO=0` in *new* pilot Preview only.
- No reviewed actives/clinical rules yet; unknown products can be stored and user-placed but must never be called validated. Photo OCR, social friend pairing, next-week progression and Google/email claim are still pending.

## Release gates — sequence (not yet all passed)
1. **Auth bootstrap** on existing `~/Code/myrota-infra` worktree, `infra/cloudflare-gate1`: `git pull --ff-only origin infra/cloudflare-gate1` then `bash scripts/gate1-auth-bootstrap.sh`. Must end `anonymous-ready`; the script never rotates a working guest secret on repeat.
2. **Backend migration and deploy** from an isolated worktree on `feat/pilot-backend-d1` only. Run `bash scripts/pilot-migrate-deploy.sh` after its CI passes. It checks branch, exact WEUR D1 UUID, actual live auth readiness, waits for explicit `yes`, applies only reviewed migrations, and deploys the existing Worker.
3. **Preview** on local `~/Code/myrota`, select `feat/pilot-vercel-ui` branch after fetching. Deploy to the existing linked Vercel project with `npx --yes vercel deploy --scope neustackdesign-gmailcoms-projects --build-env NEXT_PUBLIC_MYROTA_DEMO=0` (do not add `--prod`). Record the exact generated Preview hostname.
4. **Exact origin** in backend worktree: `bash scripts/pilot-allow-preview.sh https://YOUR-ACTUAL-PREVIEW.vercel.app`. It adds that exact Vercel hostname to Turnstile and updates the Better Auth trust secret. Never trust wildcard `*.vercel.app`.
5. **Human browser acceptance** on that *same protected Vercel Preview*: guest Turnstile → `Set-Cookie` → `/api/me` anonymous user → add one unknown product (manual or paste) → reload Shelf and verify same ID from D1 → create rota → Today AM/PM/Rest completion → refresh and verify same dated record and streak. Test second independent browser cannot see first user's Shelf.
6. Only after all checks may the pilot be described as 'testable with real data'. Do NOT claim photographic ingredient recognition, validated treatment advice, social sync or account recovery.

## Avoid repeating the last failure
- A successful Worker build or healthy D1 does not prove the branded product works. Require browser end-to-end.
- A Vercel `Ready` preview alone does not prove cookies work. Require same-origin proxy with actual guest persistence.
- Do not deploy `main` or the original `infra/cloudflare-gate1` placeholder UI over the branded Vercel Preview.
- Record Git SHA, exact Preview URL, API status and test evidence. Never rotate a working anonymous-session signing secret in place.

## Acceptance notes
- With **zero pharmacist-reviewed rules** we schedule only unanalysed user-chosen timing or harmless non-active basics with independently established evidence; we hold active-treatment products for review. The UI must not present these holds as clinical advice.
- The current pilot scan endpoint only parses pasted INCI. Real photo OCR requires Workers AI binding, 30-label benchmark (≥90% legible actives detected, zero invented validated actives, ≥80% correct identity, no confident wrong answer), and a separate release gate.
- Current Vercel connector in this ChatGPT session lacks access to the new myrota project; use the user's authenticated Mac CLI for its Preview deployment.
