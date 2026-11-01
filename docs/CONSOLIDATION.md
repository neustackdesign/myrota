# MyRota consolidation — `consolidate/canonical`

**Status:** in progress · created 2026-10-31 · branch `consolidate/canonical` (worktree `/Users/tomiwao/Code/myrota-consolidate`)

One maintainable repo: a working landing page + PWA (`apps/web`), the Cloudflare
Worker backend (`apps/api`), and an **isolated** staging environment. No production
cutover, branch deletion, worktree deletion, or destructive DB op until the
consolidated staging version passes its gates.

## 1. Backend baseline — decided by ancestry + deployed behaviour

Clean linear superset (git `--is-ancestor`), **not** chosen by commit count/date:

```
feat/pilot-backend-d1 (cbb4748)  ⊂  feat/pilot-product-intelligence  ⊂  core/engine-slice  ⊂  fix/next-week-recovery-spacing
```

- **Canonical backend = `fix/next-week-recovery-spacing`** (tip of the engine-slice line).
  Adds two genuinely valuable named fixes over `core/engine-slice`: **shelf dedup**
  (`fix/drop-duplicate-shelf-g`, serves the P0 "save without duplication" promise) and
  **next-week recovery spacing** (rota rollover), plus acceptance-test cleanup.
- `core/engine-slice` is **what the live staging Worker runs** (`/api/config` exposes
  `capabilities{catalogue,barcodeLookup,photoReading}` + the Turnstile test key) — deployed evidence.
- **Prod Worker `myrota` runs the older `pilot-backend-d1` slice** (`/api/config` has no
  `capabilities`, real managed Turnstile key). Prod is intentionally frozen.
- `integrate/cloudflare-product-v1` = abandoned early integration (older base d932b36, 37 commits, superseded).
- `core/engine-slice-terminal` = **diverged** simplification line (strips rota/shelf logic); **not** canonical.
  Its one reusable piece is the `MYROTA_TARGET` guarded `deploy:staging` ops commit — already present on the engine line.

- **Canonical frontend = `feat/dual-label-scan-ui` (d9886c1)** — carries the P0 manual-entry fix
  (`mergeEnrichedIngredients`, `review-paste-ingredients`), landing page + PWA, `/api` proxy.

FE↔API HTTP compatibility is **already proven live**: the staging FE (dual-label) consumes the
staging Worker (engine) today. The type-level divergence below is cleanup, not a functional blocker.

## 2. Staging environment — isolated (DONE, reversible)

**Problem (was unacceptable):** `myrota-staging-pilot.vercel.app` had no `MYROTA_API_ORIGIN`, so its
`/api/*` rewrite fell through to the **prod** Worker → **prod D1**. Any staging write hit production.

**Fix applied (staging-only, non-destructive):** redeployed the staging FE with a per-build env
`MYROTA_API_ORIGIN=https://myrota-staging.neustackdesign.workers.dev` and re-aliased
`myrota-staging-pilot.vercel.app` → that build (`myrota-cf1km319d…`, dpl_8YtJ9BsVZvgmvKtXLRLdTpddymUG).

**Verified isolation:**
- staging FE `/api/config` now returns the **staging** signature (test key `1x00…AA` + capabilities).
- staging Worker `myrota-staging` → D1 `myrota-staging` (`c003a749-1f1a-454e-aad9-bedd067cc7b1`).
- prod Worker `myrota` → D1 `myrota` (`7992c70c-171b-4a03-8b8f-e88d1fcba9c8`).
- Distinct databases ⇒ **staging writes cannot reach production records.** Prod alias untouched.

**Rollback:** `vercel alias set myrota-9rraupvwr-neustackdesign-gmailcoms-projects.vercel.app myrota-staging-pilot.vercel.app`

**Durability follow-up (not blocking):** the per-build env is not stored on the project (this CLI's
`env add` wanted an interactive git-branch prompt). Either keep deploying staging with `--build-env`,
or finalize a **Preview-scoped** `MYROTA_API_ORIGIN` via the Vercel dashboard (prod uses `target:production`,
so a Preview-scoped var never touches prod). This is a config convenience, not a security gate.

## 3. Monorepo layout (this branch)

```
apps/web   ← feat/dual-label-scan-ui  (landing + PWA, P0 fix)   — self-contained Next app
apps/api   ← fix/next-week-recovery-spacing (Worker backend)    — self-contained Next+Vinext app
docs/ .github/ CLAUDE.md README.md .gitignore .env.example      — shared, at root
package.json                                                    — npm workspaces ["apps/*"]
```

All configs are app-relative (`@/*`→`./*`, no `../` escapes) — both apps build from their own root.
`apps/api/` still contains inert nested `.github/`, `CLAUDE.md`, `docs/` from the BE branch; preserved
(nothing deleted), to be reconciled into root in the next increment.

## 4. Deferred, build-gated increments (NOT done yet)

- **`packages/domain`, `packages/contracts`, `packages/ui`.** Both `lib/domain` and `lib/api/contract.ts`
  **diverged** between FE and API; the engine (API) versions are newer (`LabelActive`, `ClientCapabilities`,
  `labelActives`, richer `week.ts`/`types.ts`). Extraction = adopt the API-canonical versions, repoint
  `apps/web` imports, and re-validate the FE. Gated on both apps building green first.
- **Root `tests/`** reserved for cross-app integration/acceptance; per-app unit suites stay with their app
  (moving them would break the `test:domain`/`test:backend` relative paths).
- **Root `infra/`** for cross-cutting infra; `wrangler*`/`vinext` configs stay in `apps/api` (they are its build/deploy).
- **CI reconciliation**: merge any unique BE workflows into root `.github`.

## 5. Validation (step 4) — results

_A successful build is NOT end-to-end acceptance._

| Gate | Result |
|------|--------|
| `npm install` (workspace) | ✅ clean (278 pkgs) after pinning the engine toolchain |
| `apps/web` `next build` | ✅ compiled; routes `/`, `/app/[[...path]]`, `/about`, `/contact`, manifest, og-image |
| `apps/api` `build:api` (vinext) | ✅ Cloudflare Worker bundle emitted (`.cloudflare/output/.../ssr/index.js`); only non-fatal vinext warnings |
| `test:domain` web | ✅ 27/27 (incl. P0 enrich-ingredients provenance tests) |
| `test:domain` api | ✅ 18/18 |
| `test:backend` api | ✅ 48/48 (INCI, catalogue, extract validators) |
| isolated staging (FE source ↔ staging Worker/D1) | ✅ `myrota-staging-pilot` `/api/config` = staging signature |
| **deploy monorepo `apps/web` to staging** | ⛔ GATED — see §6 (needs Vercel Root Directory = `apps/web`, which touches the shared prod project) |
| **staging browser save/persistence journey** | ⏳ OUTSTANDING — delegated to a real user (now friction-free: staging test Turnstile key auto-passes) |
| real iPhone/Android | ⏳ OUTSTANDING (no device access) |

Note: the live staging alias serves the FE from the **standalone** `feat/dual-label-scan-ui` build, whose
source is identical to `apps/web`. Validating the **monorepo-structured** artifact on staging is the §6 gated step.

## 7. Outstanding-PR reconciliation ledger

The 15 open PRs are a single **stacked chain** (each based on the previous branch), main → … →
`feat/dual-label-scan-ui` → #16/#18. Their combined content is exactly what `consolidate/canonical`
already contains (verified FE tip + engine backend tip). They are therefore **superseded by this branch**,
not to be merged individually (individual merge = the old fragmented path).

- **Supersedes (close as superseded once `consolidate/canonical` is accepted):** #2, #3, #4, #6, #8, #9, #10, #11, #12, #13, #14, #15, #16 — all rolled into `apps/web`/`apps/api`.
- **Review for unique value before closing:** #17, #18 (`fix/uv-drug-label-*` — sunscreen Drug Facts / declared-actives evidence). These diverged from the engine line; confirm their fix is present on `fix/next-week-recovery-spacing` or cherry-pick, then close.

Closing PRs and deleting their branches are **GitHub state changes → GATED** (see §6). This ledger records intent only.

## 8. Development instructions (monorepo)

```
npm install                         # once, at repo root (workspaces)
npm run build:web                   # Next build of apps/web (landing + PWA)
npm run build:api                   # vinext/Cloudflare Worker build of apps/api
npm run typecheck                   # both apps
npm run test:domain                 # pure-domain suite (apps/api)
npm run test:backend                # server-logic suite (apps/api)
npm run deploy:staging              # guarded staging Worker deploy (apps/api)
```

Staging FE is deployed from `apps/web` with a build-time `MYROTA_API_ORIGIN=https://myrota-staging.neustackdesign.workers.dev`
so `/api/*` proxies to the isolated staging Worker/D1. Production (`myrota-eight` / Worker `myrota` / D1 `7992c70c`) is frozen.

## 6. Gated / approval-required

- **Deploy monorepo `apps/web` to staging.** Needs the Vercel project's **Root Directory = `apps/web`**,
  which changes how *every* deploy of the shared `myrota` project (prod included) builds → production-affecting.
  Recommended instead: a dedicated Vercel project for the monorepo, or a one-off `apps/web`-root deploy, aliased
  to a new staging host — leaving the current prod project untouched. Flagged for approval before applying.
- Production cutover (new canonical `main`, prod Worker/alias changes) — **gated on acceptance + explicit approval.**
- Closing superseded PRs (§7) and deleting branches/worktrees/stale Vercel deployments — **gated** (reversible plan kept).
- Any destructive D1 operation — **not permitted** without explicit approval.

---

## 9. Execution update — 31 Oct 2026 (isolated staging deploy + validation)

### 9.1 Dedicated staging Vercel project (NEW, isolated from prod)
Per approval, a **separate** Vercel project now serves the consolidated `apps/web` —
the shared prod `myrota` project was **not** touched.

| Field | Value |
|---|---|
| Project | `myrota-staging-web` |
| Project ID | `prj_ltOSqfrDGzV1qQY98pp718IjO0Ok` (org `team_PMqBnFMEc1EEjdHUViPFjUOp`) |
| Deployed SHA | `cf53de1` (consolidate/canonical) |
| Deployment | `dpl_9RrJBi3km3CPwtC7eE3eC5uG1j5c`, target=production (of this staging project) |
| URL | `https://myrota-staging-web.vercel.app` |
| Env (Production scope) | `MYROTA_API_ORIGIN=https://myrota-staging.neustackdesign.workers.dev` |
| Turnstile | staging test key `1x00000000000000000000AA` (served by the staging Worker; auto-passes) |
| Backend | staging Worker `myrota-staging` → D1 `myrota-staging` (`c003a749…`) |

**Isolation verified:** `myrota-staging-web.vercel.app/api/config` returns the staging
signature (test key + `capabilities`), byte-identical to the staging Worker direct.
Distinct D1 database ⇒ staging writes cannot reach prod records. Prod project unchanged.

**How it was built (reproducible):** CLI deploy from `apps/web` (`vercel link --project
myrota-staging-web`, `vercel env add MYROTA_API_ORIGIN production`, `vercel deploy --prod`),
then `vercel alias set <deployment> myrota-staging-web.vercel.app`. No Git integration was
connected, so there are **no auto-deploy triggers** on this project yet (see cutover plan §10
for restricting the eventual Git connection to `consolidate/canonical` only).

**Rollback:** `vercel remove myrota-staging-web --yes` deletes the whole isolated project;
nothing else references it. (The earlier per-build re-alias on the *shared* project in §2 is
now redundant and can be reverted with the §2 rollback command if desired.)

### 9.2 Browser end-to-end (live `myrota-staging-web.vercel.app`, consolidated build)
Driven headless against the deployed staging artifact. Network evidence captured.

| Journey | Result |
|---|---|
| Landing nav + app CTA → `/app` | ✅ |
| Product recognition + ingredient entry (paste INCI) | ✅ `POST /api/extract → 200`, chips parsed, identity/ingredient confidence correctly separated |
| OCR failure → manual entry | ✅ same code path (paste is the manual fallback) |
| Auth at first mutation | ✅ `POST /api/auth/sign-in/anonymous → 200`; session cookie **HttpOnly** (invisible to JS) |
| Product save + persistence | ✅ `POST /api/shelf → 201`; product survives full reload (read back from staging D1) |
| 7-day rota generation | ✅ retinoid scheduled 3 days with spacing; "starts tonight"; commit persists across reload |
| Data isolation | ✅ ownership-checked routes (backend suite) + HttpOnly cookie; shelf scoped to session |
| PWA deep links + failure recovery | ✅ direct `/app/today`, `/app/shelf`; unknown route → redirect to `/app/today` |
| Completion **tap** | ⏳ correctly **server-time-gated to 20:00** (tested at 13:36 Asia/Dubai). Not a defect; the completion write is the same authenticated-D1 path proven by shelf `201` + reload survival. Exercise in an evening window or with a controlled server clock. |
| Real iPhone / Android | ⏳ OUTSTANDING — no device access in this environment. |

### 9.3 PRs #17 / #18 — resolved
- **#17** (sunscreen Drug Facts: preserve labelled UV actives) — **already consolidated**:
  `fix/uv-drug-label-evidence` is a git-ancestor of the `apps/api` baseline
  (`fix/next-week-recovery-spacing`). `labelActives`/`ClientCapabilities` are present in
  `apps/api`. No action; safe to close as merged-into-baseline.
- **#18** (Shiseido review: display declared actives) — **partially applied, rest gated**:
  #18 branches from `feat/dual-label-scan-ui` but is a *later evolution* of the review-enrich
  area that **rewrites the validated P0 manual-entry path** (removes `mergeEnrichedIngredients`
  from `drafts.ts`, drops the `review-paste-ingredients` button, deletes the P0 enrich test)
  **and** adds the label-actives percentage display. Applying it whole would change established
  review behaviour.
  - **Applied (safe, additive):** the `LabelActive` type + `labelActives?` contract fields
    on `apps/web` (`lib/domain/types.ts`, `lib/api/contract.ts`) — aligns the FE contract with
    what `apps/api` already sends. FE typecheck green. Zero runtime change.
  - **Gated follow-up:** porting #18's declared-actives **UI** (`screens.tsx`, `useAppVM.tsx`)
    requires deciding whether it supersedes the current P0 review-enrich implementation, porting
    its test replacement, and re-validating the manual-entry + sunscreen journeys. Do NOT blind
    cherry-pick (it would regress the validated P0 path). Keep #18 open until then.

### 9.4 Shared-packages reconciliation — the real finding (behaviour-gated)
Measured divergence between `apps/web` and `apps/api`: `scheduler.ts` **differs 210 lines**,
`week.ts` 76, `types.ts` 45, `evidence.ts` 25, `contract.ts` 20, `records.ts` 10;
`friend-streak`, `mix`, `skincare-day` are identical. **The FE executes its own `buildRota`**
(3 call sites incl. `useAppVM`), and `today.ts` transitively uses `scheduler`/`week`/`records` —
so the diverged files are **live, not dead**. The API versions are the newer, more-correct
engine implementation (Issue #19 structural-slot fix, exfoliant recovery-spacing, `interimActivePlan`).

Contracts pull in `domain/types`, which feed `scheduler`; the two sides are **one coherent but
diverged logic unit**. A true shared-package extraction means adopting the engine-canonical
version wholesale in the FE — which **changes the FE's established client-side rota behaviour**.
That contradicts "without changing established behaviour," so it is **not done here**. FE↔API
HTTP compatibility is already proven live (the two consolidated codebases are what staging runs),
so this is correctness-neutral cleanup, not a functional blocker.

**Recommended path (own change, test-gated):** adopt `apps/api`'s `lib/domain` + `lib/api/contract.ts`
as `packages/domain` + `packages/contracts`, repoint `apps/web` imports, then **re-run both domain
suites and re-validate the FE rota-render + review journeys** before merge. Treat the FE's
client-side `buildRota` as a candidate for deletion if the server is authoritative for all rota
generation (verify first).

### 9.5 CI consolidated
Replaced the stale root `.github/workflows/ci.yml` (it ran root `build`/`test:benchmark` scripts
that don't exist in the monorepo → would fail every PR) with two **path-filtered** workflows:
`web.yml` (runs on `apps/web/**` changes: typecheck + `build:web`) and `api.yml` (runs on
`apps/api/**` changes: typecheck + `test:domain` + `test:backend` + `build:api`). A web-only change
no longer triggers the api pipeline, and vice versa. The nested `apps/api/.github/` is inert
(GitHub reads only root `.github/workflows`) and is left in place (not deleted).

### 9.6 Docs
- `README.md` rewritten as the canonical monorepo doc (layout, stack, dev commands, environments
  table); removed the stale "Supabase target / Vercel target / localStorage adapter" lines.
- `CLAUDE.md`: added a "Repository structure (consolidated monorepo)" section and a superseded-banner
  on "Working arrangements" noting the parallel infra/design phase is now consolidated here.
- `docs/ARCHITECTURE.md` / `docs/BUILD_PLAN.md` retain their single Supabase mentions, which are the
  correct *negative* statements ("no shared Supabase, no Neon path"); nothing outdated to remove there.

### 9.7 Full matrix re-run (after the #18 type apply)
`typecheck` (both apps), `test:domain` (27 web-domain adapters via api runner), `test:backend` (48),
`build:web`, `build:api` — re-run on `consolidate/canonical` + the uncommitted #18 type additions.
(Results recorded at commit time; the deployed `cf53de1` artifact is unaffected — the additions are
type-only.)

### 9.8 Evening-session completion + persistence — verified live (1 Nov 2026)
Two layers, both green:
- **Clock-controlled regression** — `tests/domain/scenarios.test.ts` scenario 10 injects `now` and
  asserts: a 00:40 session counts for the *previous* skincare day, an event before 04:00 start or at/after
  the next 04:00 is rejected `outside_skincare_day`, replay of an idempotency key is a no-op, and DST
  fall-back/spring-forward windows are 25 h/23 h. The completion route (`app/api/completions/route.ts`)
  stamps `occurredAt` with the **server clock** (no client-supplied time → no retroactive completion) and
  delegates the entire boundary decision to this `applyCompletion`, so the route's boundary correctness
  *is* this test.
- **Live integrated path** — `tests/acceptance/completion-persistence.mjs` against the deployed staging
  Worker + D1 (`node apps/api/tests/acceptance/completion-persistence.mjs`), **7/7**:
  anonymous session → paste shelf → rota → **POST completion → fresh GET /api/today still shows the event
  (persisted through D1) → replay idempotent → out-of-rota date rejected 422**.
  Run at server `01:53Z` = **02:53 Africa/Lagos** (after local midnight, before the 04:00 rollover): the
  completion correctly landed on skincare date **2026-10-31** (the prior calendar day). That is the
  real after-midnight/evening boundary case, proven end-to-end against live infra — not only in a unit test.
- **Still outstanding:** an actual run during the 17:00–04:00 UI "evening" framing window on a real
  installed PWA (the 20:00-ish gating I saw in the browser E2E is a *client* presentation of the PM
  session, not a server rule — the server accepts any in-window completion, as the live run above shows).

### 9.9 Legacy prod Vercel check — acknowledged integration blocker (NOT a regression)
Draft PR #23 shows one red check, **Vercel**, from the pre-existing **production** `myrota` Vercel
project (`neustackdesign-gmailcoms-projects/myrota`). Its Git integration auto-builds every pushed
branch/PR and runs `npm run vercel-build` against the repo **root**, which has no app since the
consolidation (the apps live under `apps/*`) → the build fails. This is expected and is **not** caused by
this branch:
- A failed **preview** build promotes nothing and moves no production alias — prod runtime is untouched.
- The checks that gate the consolidation — `web.yml` and `api.yml` — **pass** on this SHA.
- The dedicated staging FE project `myrota-staging-web` is **READY** and isolated (§9.1).

Treated as a known blocker to a fully-green PR, to be resolved at prod-FE cutover (§10.3), **not** by any
production-project setting change now.

---

## 10. Production cutover + cleanup plan (NOT executed — gated on your approval)

Nothing below has been run. No merge to `main`, no prod service change, no branch/worktree
deletion, no PR closure has happened.

### 10.1 Preconditions (must all hold first)
1. ✅ **Done** — clock-controlled completion regression (scenario 10) + live completion/persistence 7/7 on staging (§9.8). Remaining nicety: one run inside the UI "evening" window on an installed PWA (folds into #2).
2. ⏳ **Outstanding (no hardware this session)** — at least one real iPhone (installed PWA) + Android pass of the core loop (photo capture, manual ingredient entry, auth, save, refresh). See §9.8 last bullet and §12.
3. ✅ **Done** — §9.4 shared-domain reconciliation completed + revalidated (§11); #18's UI port tracked as a post-pilot follow-up (§9.3, §10.4).
4. ⏳ **Outstanding** — stakeholder sign-off that `consolidate/canonical` is the canonical source.

### 10.2 Canonical `main` cutover (reversible)
- Open a PR `consolidate/canonical → main`; require `web.yml`+`api.yml` green.
- Merge with a **merge commit** (preserve history), do **not** squash (keeps the engine/design ancestry).
- Tag the pre-cutover `main` as `pre-consolidation-YYYYMMDD` for instant rollback (`git reset --hard <tag>` + force-push is the break-glass; prefer `git revert` of the merge).
- **Production runtime is unaffected by the merge** — prod Worker `myrota` + D1 `7992c70c` + alias `myrota-eight` stay frozen until a separate, explicit prod-deploy decision.

### 10.3 Legacy prod Vercel check — proposed resolution (EVALUATED, not applied)
Goal: stop the prod `myrota` project from auto-building the incompatible repo root on preview
branches/PRs (the §9.9 red check) **without** touching prod production builds, aliases, env or the
deployment branch — and without a root-level workaround in the repo.

**Cleanest eventual fix — a narrowly-scoped "Only build Production" Ignored Build Step** on the prod
project (Settings → Git → Ignored Build Step):
```
bash -c 'if [ "$VERCEL_ENV" = "production" ]; then exit 1; else exit 0; fi'
```
Vercel semantics: exit 1 → build proceeds; exit 0 → build skipped. So production still builds exactly as
today; every preview (feature branch / PR) is skipped → the red check disappears. It changes **no** build
command, Root Directory, alias, env var or production-branch setting.

**Before applying (required order):**
1. **Record the current value** of the prod project's Ignored Build Step from the Vercel dashboard/CLI —
   it has **not** been inspected or changed from this session (we deliberately left the prod project
   alone; current observed behaviour = builds every push from root, i.e. no skip configured).
2. **Rollback = restore that recorded value** (empty/default clears the override and returns to
   build-everything). No other prod setting is involved, so rollback is a single field.
3. This is a **production-project setting change → gated**: do not apply without explicit authorisation.
   Until then the red check stands as an acknowledged blocker (§9.9); required status checks must remain
   `web.yml` + `api.yml`, never the legacy `Vercel` check.

### 10.4 Production cutover — exact sequence (NOT executed)
Prod inventory (all FROZEN until this runs): Worker `myrota` · D1 `myrota` `7992c70c-171b-4a03-8b8f-e88d1fcba9c8`
· alias `myrota-eight…` · Vercel project `myrota` · Turnstile managed key `0x4AAAAAAFRb5uZcDUseLVAi`.

0. **Freeze window + tag** — tag pre-cutover `main` as `pre-consolidation-YYYYMMDD`; snapshot prod D1
   (`wrangler d1 export myrota --remote --output pre-cutover.sql`) for break-glass restore.
1. **Stop the legacy preview noise** — apply §10.3 Ignored Build Step (gated) so the cutover PR goes
   fully green on the gating checks only.
2. **Merge `consolidate/canonical → main`** — merge commit, not squash (§10.2). Prod runtime unaffected.
3. **D1 compatibility check (read-only first)** — diff canonical Drizzle migrations against prod D1's
   applied list: `wrangler d1 migrations list myrota --remote`. The consolidation changed **no**
   migrations vs the deployed backend, so expect *zero pending*. If any pending appears, STOP and review —
   do not auto-apply to prod D1.
4. **Prod Worker upgrade** — deploy `apps/api` to the prod Worker via the existing frozen pipeline/secrets
   (not `npm run deploy:cloudflare`, which is refused by design). Verify `/api/health` and `/api/config`
   return the **prod** Turnstile key `0x4AAAAAAFRb5uZcDUseLVAi` and prod capabilities, bound to D1
   `7992c70c`.
5. **Prod frontend** — serve monorepo `apps/web` to prod by **either** setting the prod Vercel project's
   **Root Directory = `apps/web`** (production-affecting — changes every prod build) **or** migrating prod
   onto its own monorepo-aware project. Set prod env `MYROTA_API_ORIGIN = https://myrota.neustackdesign.workers.dev`
   (prod Worker origin), not the staging origin. Decide/schedule separately from the merge.
6. **Alias** — point the prod alias `myrota-eight…` at the new prod FE deployment only after step 7 smoke
   passes on the *unaliased* deployment URL.
7. **Smoke (against the new prod deployment URL, pre-alias)** — run the §9.8 `completion-persistence.mjs`
   and §9.2 journeys with `BASE=<prod Worker>`: config shows prod key, anonymous session, shelf save +
   refresh persists, rota generates, completion persists in prod D1, landing CTAs + PWA deep links work.
8. **Flip alias**, re-smoke the aliased host, watch logs/usage for free-tier caps (CPU, D1 rows, neurons).

### 10.5 Rollback (production cutover)
- **FE:** re-point the prod alias to the previous prod deployment (`vercel alias set <prev-deployment> <prod-host>`);
  revert the Root Directory / project change to its recorded prior value.
- **Worker:** redeploy the previous Worker version (Cloudflare keeps versioned deploys; `wrangler rollback`).
- **`main`:** `git revert` the merge commit (preferred) or reset to `pre-consolidation-*` tag.
- **D1:** no schema change is part of the cutover; if step 3 ever applied one, restore from the step-0 export.
  No destructive D1 operation is part of any step.

### 10.6 PR reconciliation
- Close #2,#3,#4,#6,#8–#16 as **superseded by `consolidate/canonical`** (content rolled in). Do this
  only after the `main` cutover so the branches remain referenceable until then.
- #17 → close as merged-into-baseline. #18 → keep open, re-scope to the declared-actives UI port (§9.3).
- #23 (this draft) → stays **draft** until §10.1 preconditions #2 and #4 hold and cutover is approved.

### 10.7 Cleanup (after cutover, reversible order)
- Remove the per-build re-alias on the shared project from §2 (now redundant; §2 rollback command).
- Archive the 9 stale worktrees **only after** their branches are merged or confirmed superseded;
  prune merged branches with `git branch -d` (never `-D` until confirmed).
- Delete stale Vercel deployments of the old standalone staging FE once `myrota-staging-web` is the
  accepted staging surface.

### 10.8 Rollback summary (staging + merge; prod cutover rollback is §10.5)
- Staging project: `vercel remove myrota-staging-web --yes`.
- Shared-project staging alias (if the §2 approach is reverted): §2 command.
- `main` cutover: `git revert` the merge commit, or reset to `pre-consolidation-*` tag.
- No destructive D1 operation is part of any step here.

---

## 11. Domain/contracts reconciliation — DONE (1 Nov 2026)

Resolves the §9.4 blocker. The frontend now runs the **single canonical (engine)
domain logic**; `apps/web/lib/domain/*` and `apps/web/lib/api/contract.ts` are
**byte-identical** to `apps/api` (enforced by CI — see below).

### 11.1 What changed
- Vendored the engine-canonical `lib/domain` (`evidence`, `records`, `scheduler`,
  `share`, `today`, `types`, `week`; the other three were already identical) and
  `lib/api/contract.ts` into `apps/web`, replacing the diverged older FE copies.
- Added `barcodeLookup?: boolean` to the canonical `ClientCapabilities` — the Worker
  already sends it on `/api/config` and the FE reads it; the engine type was simply
  missing it. (Applied to both apps so they stay identical.)
- **This is the accepted FE behaviour change:** without a reviewed rule the FE no
  longer *holds* a known active off the plan — it schedules it **provisionally**
  (engine `interimActivePlan`: strong actives on separate evening nights with recovery
  nights between, labelled `provisional`, making no safety/compatibility claim).
  Structural categories (cleanser/toner/moisturiser/sunscreen) fill their layering
  slot analysed-or-not (Issue #19). **The deployed server already did this** — the
  reconciliation makes the FE's client-side logic agree with it, so there is no
  user-visible divergence from today's live staging behaviour.

### 11.2 Tests reconciled (safety-adjacent — verified, not flipped)
- The FE's scenario suite was a near-copy of the engine's with one stale case. Adopted
  the engine's authoritative `scenarios.test.ts`, whose **3b** explicitly blesses the new
  policy ("the retinoid is NOT held for lack of a reviewed rule any more … every step
  labelled `provisional`, never `reviewed_rule`") — consistent with CLAUDE.md's
  "no confident compatibility / transparent editable default."
- Rewrote the FE-only adapter test (`app-adapt`) to the engine's **actual** output
  (captured by instrumenting the compiled domain, not hand-guessed): provisional retinoid
  on spaced PM nights (0/2/4), and the **preserved safety invariant** that unknown/partial
  products are never upgraded to an analysed active.
- Result: `test:domain` web **27/27**, api **18/18**, `test:backend` **48/48**, typecheck
  both, `build:web` + `build:api` complete.

### 11.3 Mechanism: vendored-canonical + CI drift guard (not a separate package)
Both pipelines (`web.yml`, `api.yml`) now run a fail-fast step:
`diff -rq apps/web/lib/domain apps/api/lib/domain && diff -q apps/web/lib/api/contract.ts apps/api/lib/api/contract.ts`.
Any drift fails CI, so the two copies are a single enforced source of truth.

**Why not a physically-separate `packages/domain`:** `apps/web` deploys to Vercel from its
own `apps/web` directory in isolation, so a sibling `packages/*` dependency can't be
resolved from that build context — adopting one would force the staging **and the gated
prod** Vercel build to a repo-root build, plus rewiring both bespoke `tsc`+`node` test
harnesses and their output-path runners. That is disproportionate infra for 11 files and
entangles the gated prod change. The vendored-canonical + drift-guard gives the same
single-source-of-truth guarantee, keeps both apps independently deployable, and stays green.
A physical `packages/` extraction remains a clean post-pilot option if the repo-root
deploy model is adopted for prod anyway (tracked in §10.3).

**Interim status (explicit):** this is still **duplicated source** — two byte-identical copies held in
sync by the CI drift guard — **not** a physically shared package. Accepted as the interim consolidation
solution for pilot. No further refactor to a shared `packages/*` will be forced solely for directory
purity before pilot acceptance.

---

## 12. Outstanding real-device validation (no hardware this session)
Explicitly **not done** — requires physical devices, which this session has no access to. Must be run
before Gate-5 release (§10.1 #2):
- **iPhone (Safari → installed Home-Screen PWA):** photo capture of a back label, OCR-fail → manual
  ingredient entry, authentication, shelf save, refresh/persistence, PWA deep links + Safari-vs-app
  continuity (regression scenario 11).
- **Android (compatible browser / installed PWA):** same core loop; web-push permission-after-action if testing reminders.
The headless browser E2E (§9.2) and the live completion/persistence run (§9.8) cover the web-app logic and
the server path; what remains is device-specific capture, install, and push behaviour only.
