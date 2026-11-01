# core/engine-slice — reconciliation, staging photo reading, guarded deploy (11 Oct 2026, later)

Continues `docs/HANDOFF_2026-10-11.md`. Production `myrota` stays frozen at
`c600deaa`; nothing here deploys it.

## 1. What the remote branch actually contained

`origin/core/engine-slice` @ `25af14f` (handoff doc) was checked before any work:

| Reported as done | On the remote branch? |
|---|---|
| Staging merge of `integrate/cloudflare-product-v1` (`-s ours`) | **No.** No merge commit exists on any remote branch (`git log --all --merges`). |
| Guarded staging deploy configuration | **No.** `cloudflare.config.ts` still hard-coded `myrota`; no staging script. |
| Seven live staging acceptance scenarios | **No.** Only the 3-shelf red-team `tests/acceptance/shelf-scenarios.mjs`. |

If that work exists in a local worktree it was never pushed. This branch adds
its own versions; reconcile file-by-file if a local copy surfaces.

## 2. Why staging reports `photoReading: false`

`photoReading` is `Boolean(env.AI) && env.PHOTO_READING_ENABLED === "1"`
(`lib/server/capabilities.ts`).

**Live evidence (owner, read-only, 11 Oct — PR #20 comment):**
`https://myrota-staging-pilot.vercel.app/api/config` and
`https://myrota-staging.neustackdesign.workers.dev/api/config` return the SAME
staging payload (Turnstile test site key, `capabilities: {catalogue: true,
barcodeLookup: true, photoReading: false}`). Production returns a different
Turnstile key and no `capabilities`. **So the public staging PWA already
reaches the staging Worker; the Vercel proxy is not the cause.**

An earlier draft of this section suspected the Vercel rewrite fallback
(`MYROTA_API_ORIGIN || https://myrota.neustackdesign.workers.dev`). That was
inferred from the UI branch's code/docs without live access and is **ruled out**
by the evidence above. Do not change `MYROTA_API_ORIGIN` on that basis; the
effective alias already resolves correctly.

**Actual cause — the staging Worker has no `env.AI` and/or flag.**
`@vinext/cloudflare deploy` reads only `cloudflare.config.ts`, which declared
`ASSETS` + `DB` and nothing else. The earlier working staging used
`wrangler.staging.jsonc` (which has `ai`) plus operator-set vars. A vinext
deploy to staging therefore ships a Worker without the AI binding (and, if
`PHOTO_READING_ENABLED` was a plain dashboard var, without the flag).
**Fixed in code (§3), not yet deployed.**

Unchanged: the capability formula, `/api/extract` quotas (per-IP/per-user/global,
charged again for the second front-label inference), auth, and never logging
or persisting images.

## 3. Guarded staging deploy (fixes the 11 Oct incident root cause)

- `cloudflare.config.ts` is now mode-aware. The default mode resolves to
  exactly the previous production target (verified on the built
  `worker.config.json`: `myrota`, `ASSETS` + `DB:myrota`). Mode `staging`
  resolves to `myrota-staging` with `DB:myrota-staging`, `AI`,
  `PHOTO_READING_ENABLED=1`, `MYROTA_VISION_MODEL` and `MYROTA_VISION_FORMAT`.
- `npm run deploy:staging` (`scripts/deploy-staging.mjs`) runs these steps and fails closed at any of them:
  resolve config in staging mode → `vite build --mode staging` → verify the
  **built artifact** (`.cloudflare/output/v0/workers/default/worker.config.json`
  and the build mode) names only `myrota-staging`/`myrota-staging` with AI and
  the flag, and never production → `vinext-cloudflare deploy --env staging --skip-build`
  (uploads exactly the verified artifact) → postflight `/api/health` +
  `/api/config.capabilities.photoReading === true` → `wrangler deployments status`.
- `npm run deploy:staging:dry` runs every check without uploading. Verified here: PASS.
- `npm run deploy:cloudflare` and `npm run deploy:vinext` now **refuse**.
  Production is frozen.
- If an earlier operator set `PHOTO_READING_ENABLED` as a Worker **secret**,
  the first deploy fails on the duplicate binding name rather than silently.
  Remove the secret (`wrangler secret delete PHOTO_READING_ENABLED --name myrota-staging`)
  and redeploy. Existing secrets (auth, Turnstile, trusted origins) are untouched.

## 4. Engine changes in this pass

- **Recovery spacing (`recovery-spacing-v1`)** in `lib/domain/scheduler.ts`.
  This is a general routine suggestion, editable, and not a medical rule.
  Interim strong actives share a budget of at most 4 strong-active nights a
  week; reviewed rules and product directions keep their own cadence. The
  night after an exfoliant night has no retinoid or exfoliant, and an
  exfoliant night never directly follows another strong night. Both checks
  also apply across the week boundary through `previousFinalNight`. The
  reason is on every strong step, and the following night's steps say
  "Recovery night after last night's exfoliant…". A product that does not
  fit is held with `weekly_limit` and named in Shelf Check, not hidden.
  Shelf A (retinoid + AHA) went from **6 strong nights in a row** (retinoid
  1/3/5, AHA 0/2/4) to AHA 0,4 · retinoid 2,6 · recovery 1,3,5.
- **SPF-last bug fixed.** An *unanalysed* sunscreen ranked 8, ahead of
  moisturiser at 9 (Issue #19 red-team defect #2). Structural categories now
  rank by category whether or not they are analysed.
- **Drug Facts UV filters → sunscreen.** `classifyLabelActive` is shared by
  shelf save and the tests. An uncategorised product whose labelled actives
  are UV filters is laid out as a sunscreen.
- **Replan continuity (`reviseRota`, `lib/domain/week.ts`).** A Shelf change
  mid-week revises the same week instead of starting a new one at today with
  a fresh Rescue:
  - Kept from the old revision: start date, week number, previous rota,
    `rescueUsedFor` and the reflection.
  - Past days and any day with recorded activity keep their plan.
  - Only the remaining days are rebuilt.
  - `supersedes` lists earlier revisions, so their day records still count.

  Related fixes:
  - `recordsForRota`, `listMisses` and `applyRescue` follow the chain.
  - `/api/completions` writes into a day's existing record within the chain,
    so an AM before a replan and a PM after it qualify one day.
  - `/api/today` loads 8 rotas plus their revision chains, so a replan cannot
    push last week out of the streak.
  - A finished week is still not revised: a new week starts with
    `previousRotaId` set and the week number incremented. The old code reused
    the stale week number and the wrong previous rota.

## 5. Test results (this container, offline)

| Suite | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run test:domain` | 18/18 |
| `npm run test:backend` | **47/47** (38 existing + 9 new engine scenarios A–G) |
| `npm run test:merge` | 6/6 |
| `npm run test:benchmark` | 8/8 (evaluator only — not a real-label run) |
| `npm run build` (next) | PASS |
| `vite build --mode staging` + artifact guard | PASS |

New: `tests/backend/engine-scenarios.test.ts`. It uses the real parsers (paste →
`toInciIngredients`; the Shiseido Drug Facts transcript → `parseFrontLabel` →
server classification) and the live, empty rule set:

- A — pasted INCI retinol, scheduled at night
- B — Shiseido UV filters, SPF last, full INCI stays unknown
- C — SPF last including an unanalysed sunscreen
- D — PHA spacing
- E — vitamin C + niacinamide daily
- F — retinoid/AHA alternation with a recovery night between every pair, ≤4 strong nights, reasons, week boundary
- G — complete day 0, add a retinoid: day 0, streak and misses unchanged
- G2 — mid-week: a pending miss stays eligible and a spent Rescue stays spent
- G3 — a finished week is not revised

`tests/acceptance/engine-live.mjs` runs the same invariants against a live origin
(Worker or the Vercel PWA). **It has not been run.** This container's network
policy denies `*.workers.dev` and `*.vercel.app`, and it has no Cloudflare credentials.

## 6. The 37 `integrate/cloudflare-product-v1` commits

Each commit's added lines were compared with `core/engine-slice`. "Present"
means every added line is in the current tree, or the remainder was replaced
by a later, stricter change (named).

| Commit | Subject | Status on `core/engine-slice` |
|---|---|---|
| `6e507a5` | docs: Claude Code UI-only parallel prompt | **Dropped intentionally**: superseded process doc (Issue #19 makes `core/engine-slice` the single working branch). |
| `7efb93c` | docs: Gate 1 preflight status (8 Oct) | **Dropped intentionally**: its "nothing provisioned" status is now false (Workers + D1 are live); restoring it would be a false claim. |
| `61f1e29` | docs: Rescue deadline at the 04:00 rollover that ends the day | **Was missing → restored** (cherry-pick `98c8e3b`). |
| `691cc11` | docs: lock WEUR D1 primary | **Was missing → restored** (`c79a9bf`). |
| `6b752f5` | docs: D1 primary rationale | **Was missing → restored** (`69873f2`). |
| `37756c7` | domain contracts, 18 scenario tests, repositories, brand primitives | Domain/contract/tests present (`lib/domain/*`, `lib/api/contract.ts`, `tests/domain/*`, later extended). UI primitives, repositories and demo live in the Vercel UI app, not the Worker. |
| `f9022c4`, `227f93d`, `df2dc7d` | UI screens, sheets, state gallery, screenshots | Vercel UI app (redesigned in `lib/app/useAppVM.tsx`); not part of the Worker tree. `df2dc7d`'s scheduler/test edits are present. |
| `a7aec96` | tsconfig include / ignore lockfile | `.gitignore` present; the tsconfig line is Next-generated and regenerates. |
| `b7c48d0` | combine UI + Cloudflare backend | Backend present: auth, D1 schema/migrations, claim-merge, Gate 1 scripts, `cloudflare.config.ts`. Remaining lines replaced later: `/api/config` providers forced off until a verified merge; `trustedOrigins` → `allowedOrigins(appUrl, MYROTA_TRUSTED_ORIGINS)`; shelf-store server-side re-normalisation. |
| `67556a6`, `b5c8822` | dependency reconcile, lockfile tracking | Present. |
| `60017a9` | CI gate | Present (CI workflow evolved later). |
| `31a11c4`, `5b3dc0a` | live Turnstile config, shared type | In the Vercel UI `lib/client/turnstile.ts`, superseded by a version with timeouts and a retry error. |
| `6784927` | remove duplicate Turnstile globals from auth smoke | Not applicable: depends on `lib/client/turnstile.ts`, which is not in the Worker tree. The smoke harness keeps its local type, same behaviour. |
| `87b95d6` | explicit scan format confidence in contract | Present. |
| `d21bb34` | never classify unreadable as leave-on | Present in the Vercel UI (`lib/client/drafts.ts`). This pass also removed a leave-on default from the acceptance harness. |
| `e352dc0` | "Not sure" format on review | Present in the redesigned Vercel UI (`unkFormats … "Not sure"`). |
| `3101379` | demo repository format marking | Demo only; not deployed. |
| `73bba96`, `6fe128d` | shelf edit/correct/finish/delete | Present. |
| `086e1d5` | extract route (paste only, photo 501) | Replaced by the real gated Workers AI route; paste now uses `splitInciList`/`toInciIngredients`. |
| `fae90e4` | catalogue returns no results | Replaced by the real provenance-tracked catalogue. |
| `4f1996b` | mix route | Present. |
| `9a1fc48`, `d477904`, `83a9d86`, `0159c7b`, `b3d81c3`, `7f1dea5`, `12da142` | rota/day-record persistence and routes | Present. `83a9d86`'s "return existing rota unconditionally" was **deliberately replaced** (stale-rota bug, Issue #19 #3), now by `reviseRota`. |
| `3bcb2c0` | send browser timezone header | Present in the Vercel UI (`lib/api/http-repository.ts`). The server reads `x-myrota-time-zone`. |
| `8c3b6c8` | persist guest name, report rota status | Present (`app/api/me/route.ts`). |
| `32c9121` | remove unused import | Present (code later rewritten). |
| `c14f56e` | one active rota per owner (unique index) | Present in migration `0002`. |

## 7. Still open (functional, not done here)

1. **Live verification has not been done in this session.** Still to run on staging:
   - `npm run deploy:staging` from a machine with Cloudflare credentials.
   - `BASE=https://myrota-staging.neustackdesign.workers.dev SHISEIDO_IMAGE=… node tests/acceptance/engine-live.mjs`.
   - Then the same with `BASE=https://myrota-staging-pilot.vercel.app` (already routed to the staging Worker).
   - Then the visual PWA journey on an iPhone (camera + gallery).

   Until those pass, this pass has no real scan or staging result to report.
2. The Vercel UI must render `RotaStep.reason`, the recovery-night reason
   and the `weekly_limit` Shelf Check line. The Worker returns them; UI
   rendering is on the UI branch.
3. Product directions are not yet extracted as source-attributed
   observations, so no plan uses the `product_directions` label. The ≤4 cap
   exempts them once they exist.
