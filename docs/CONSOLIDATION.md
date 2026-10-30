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

_Appended after install/build/test runs; a successful build is NOT end-to-end acceptance._

| Gate | Result |
|------|--------|
| `npm install` (workspace) | pending |
| `apps/web` `next build` | pending |
| `apps/api` `build:vinext` | pending |
| `test:domain` (pure domain) | pending |
| `test:backend` | pending |
| staging browser journey (test Turnstile key) | pending |
| real iPhone/Android | OUTSTANDING (no device access) |

## 6. Gated / approval-required (step 5)

- Production cutover (new canonical `main`, prod Worker/alias changes) — **gated on acceptance + explicit approval.**
- Deleting branches/worktrees/stale Vercel deployments — **gated** (reversible plan kept).
- Any destructive D1 operation — **not permitted** without explicit approval.
