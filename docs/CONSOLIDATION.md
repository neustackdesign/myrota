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
