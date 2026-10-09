# Overnight release report — Landing (1) + PWA v1.6

**Date:** 9 Oct 2026 (UTC) · **Branch:** `claude/focused-cray-sahnof`, based on `feat/pilot-vercel-ui` @ `a22db6c` · **Draft PR:** [neustackdesign/myrota#6](https://github.com/neustackdesign/myrota/pull/6), base `feat/pilot-vercel-ui`, never `main`.

## 1. Links

| Surface | URL | Status |
|---|---|---|
| Landing | `https://myrota-git-claude-focu-8ef232-neustackdesign-gmailcoms-projects.vercel.app/` | Vercel status **Ready** (branch alias, stable across pushes). **Not opened by me:** this sandbox's egress blocks `*.vercel.app`. |
| PWA | `https://myrota-git-claude-focu-8ef232-neustackdesign-gmailcoms-projects.vercel.app/app` | Same deployment. Sign-in on the Preview needs the operator step in §6 first. |

Vercel deployment IDs are recorded per push in §8. Each push redeploys under the same branch alias.

This is a **Preview, not Production**. No `--prod`, no alias overwritten, `main` untouched. Whether stakeholders can open it without a Vercel login depends on the project's Deployment Protection, which I cannot see (see §6).

## 2. Release gates

| Gate | Result | Evidence |
|---|---|---|
| Landing renders all 7 chapters, design parity | **PASS (local)** | side-by-side vs the original HTML at 1440: hero/TU/WE/FR match ~1px; `docs/screenshots/responsive/` |
| Landing responsive 375–2560, no horizontal overflow, no console errors | **PASS (local)** | `docs/screenshots/responsive/widths.json` (27 page×width checks, 0 overflow, 0 errors) |
| Landing reduced motion, keyboard (chapter buttons, FAQ `aria-expanded`), skip link | PASS (code + local) | — |
| Landing CTAs open the real PWA; no fixture invite URL; footer links resolve | **PASS** | `/app?src=landing`; `/legal/*`, `/about`, `/contact` |
| Landing photos load | **FAIL / pending** | Pexels CDN URLs; not visually verified and not self-hosted (egress blocked). Grain fallback, no broken images. |
| PWA v1.6 screens, faithful to the source | **PASS** | generated from the source; 65 design states in `docs/screenshots/v1.6-states/` |
| PWA real guest session, 3-product shelf, reload persistence, rota, completion idempotency, same rota on reload, no second active rota, cross-browser isolation, Mix default | **PASS (local real-backend E2E, 15/15)** | §4 |
| Same on the live Vercel Preview + live Worker + production D1 | **NOT RUN** | sandbox cannot reach the Preview or Worker; needs the §6 operator step + a human browser run (§7) |
| 04:00 user-local boundary | **PASS** | domain tests (DST, Lagos/Dubai) + live-local run at 01:30 Lagos recorded against the previous skincare day |
| No fixture bleed in the production bundle | **PASS** | scan of `.next/static` for Ama/Tobi/Crystal Retinal/`a8Kb4Q`/`kemi@example.com`/`482913`: 0 |
| No false clinical assertions | **PASS** | no reviewed rules → actives held; Mix → Not enough evidence; flag/alert fixtures demo-only |
| Social / Rescue / Swap / reflection / week 2 / reminders / claim / photo OCR | **GATED** (honest copy) | no Worker endpoints; matrix in `docs/PROTOTYPE_TO_PRODUCTION_MATRIX.md` |
| Typecheck, domain tests (22), benchmark tests, `next build` | **PASS** | §4 |
| Vinext build of the UI branch | NOT RUN | UI branch has no Vinext config (backend is the Worker) |
| Infra: D1 preserved, migrations not rerun, no Worker change, no secrets touched | **PASS** | nothing deployed to Cloudflare; no remote writes |
| Turnstile + Better Auth trust exact preview host | **BLOCKED → operator** | §6 |
| PWA install / service worker on real devices (iOS + Android) | NOT RUN | needs devices (§7) |

## 3. Real vs simulated

**Real (Worker + D1 via the same-origin `/api` proxy):**

- Guest session on the first write (Turnstile).
- Shelf add (unknown by name with placement; pasted INCI → review → corrections → placement), list, placement change, finish, remove.
- Rota create with transient private context, reveal, Today.
- AM/PM/Rest completions with read-back.
- Streak continuity / earned, misses, the 04:00 day.
- Week-end summary.
- Mix Check via `/api/mix`.
- Display name.

**Gated (visible, honest, does nothing fake):** photo reading, catalogue matches, Rescue, Swap, reflection persistence, week 2, invites / Friend Streak / nudges, reminders and push, account claim (Google/Apple/email), share images (the share sheet sends text + the real URL).

**Demo-only (`/dev/states`, `NEXT_PUBLIC_MYROTA_DEMO=1` builds only):** all 65 prototype states with their fixtures.

## 4. Tests run

```
npm run typecheck                         PASS
npm run test:domain                       PASS 22/22 (18 existing + 4 new adapter tests)
npm run test:benchmark                    PASS
NEXT_PUBLIC_MYROTA_DEMO=0 next build      PASS (routes: /, /app/[[...path]], /legal/*, /about, /contact, /dev/states→404)
NEXT_PUBLIC_MYROTA_DEMO=1 next build      PASS (gallery)
```

**Local production-like E2E.** The production Next build at 390×844 (Africa/Lagos) talks through `/api` to the **real `feat/pilot-backend-d1` @ `cbb4748` Worker bundle** (Vinext build) running in Miniflare against a **fresh local D1** migrated with the branch's own `0001`/`0002` SQL. Better Auth used a throwaway local secret. Turnstile was a **test double** at both the browser script and the siteverify call, accepting only Cloudflare's documented always-pass test secret; the real Turnstile path is *not* proven by this run. Results are in `docs/screenshots/local-real-backend-e2e/results.json`; screenshots are alongside:

1. fresh guest sees Welcome; no session is created on page view
2. anonymous session created on the first write
3. product 1 (unknown, morning) saved — `POST /api/shelf 201`
4. pasted product saved
5. product 3 saved
6. a duplicate typed name shows "On shelf"
7. three products persist after reload
8. pasted + corrected product stays `user_confirmed` / `corrected` (never upgraded)
9. rota created and persisted (local rota ID)
10. a double-click on "Mark evening done" records **one** event
11. same rota ID after reload
12. a second `POST /api/rotas` returns the existing active rota
13. Mix with unanalysed products → Not enough evidence
14. a second browser has no session; shelf 401; completing the first user's rota 401
15. no uncaught page errors

**Design parity.** 65/65 states render with 0 page errors (`docs/screenshots/v1.6-states/`). Landing chapters compared against the original HTML render.

**Fixed during QA:**

- Toasts were hidden behind sheets.
- Images that failed before hydration showed a broken icon.
- The paste-sheet submit binding reopened the sheet (inherited from the prototype).
- The Better Auth "Anonymous" name rendered as an "A" avatar.
- The strip read "Daily night".
- Design-only screens and the fixture link were moved out of the production bundle.

## 5. Images

`lib/assets/slots.ts` maps every design slot to the PR #4 Pexels candidates:

- 7269486 (Anete Lusina)
- 6579978 (Alex Starnes)
- 5938600 and 5938589 (Sora Shimazaki)
- 7269467 (Anete Lusina)

All are under the Pexels licence, with no endorsement implied. **Status: pending.** I could not download them, view them, self-host them or hash them (Pexels is egress-blocked), and the Retna candidate remains unverified. A slot without a working image shows its designed Grain field. The OG/Twitter card is now a generated typographic 1200×630 (`/opengraph-image`): no photo rights needed and no user data.

## 6. Operator handoff (one consolidated action list)

**A. Trust the exact preview host** in the Worker (Better Auth trusted origin) and in the Turnstile widget. Run from your Cloudflare-authenticated backend worktree on `feat/pilot-backend-d1`, using the existing guarded script; it keeps existing Turnstile domains, asks for `yes`, and writes no other secret:

```bash
bash scripts/pilot-allow-preview.sh https://myrota-git-claude-focu-8ef232-neustackdesign-gmailcoms-projects.vercel.app
```

Note: the script *replaces* `MYROTA_TRUSTED_ORIGINS` with this one host, so the older PR #4 preview stops being trusted for sign-in. That is intended for a single dedicated test preview.

**B. Vercel.** For this branch's Preview:

- Make sure `NEXT_PUBLIC_MYROTA_DEMO` is unset or `0`. If the earlier `=1` was set for *all* Previews, scope it to the old demo branch only, then redeploy.
- Make the Preview viewable by stakeholders: either a Deployment Protection *shareable link* for this deployment, or protection off for Previews.

**C. Photos:** download the five Pexels files, review their crops against the slot briefs (`docs/NEW_DESIGN_SOURCE_AUDIT.md` image register), and commit them to `public/media/`. I'll then switch `src` to the local paths and record hashes.

## 7. Human verification still required (after §6)

In a fresh private browser on the Preview:

1. Pass Turnstile.
2. Confirm the session cookie.
3. Add 3 products, reload.
4. Build the rota and note its ID (`/api/rotas/current`).
5. Mark AM, then PM or Rest; reload.
6. Double-tap a completion.
7. Open a second browser and confirm the data is isolated.
8. Run Mix and confirm "Not enough evidence".
9. Check iOS Safari Add to Home Screen and Android install.
10. Share the URL in WhatsApp to check the OG preview.

## 8. Release record and rollback

| Item | Value |
|---|---|
| Preview commits | see `git log feat/pilot-vercel-ui..claude/focused-cray-sahnof`; final head and Vercel deployment ID in PR #6 status |
| Deployment `7582d53` | Vercel `AkyqPLtoSLPZw3AqakWj91H1GczQ` (Ready) |
| Worker | unchanged by this work. Last reported Gate 1 version `aa51201-c627-4459-b51e-d0dcf2867887`; current serving version **not re-verified** (Worker unreachable from the sandbox) |
| D1 | `7992c70c-171b-4a03-8b8f-e88d1fcba9c8`: no reads or writes from this work; migrations 0001/0002 not re-run |

**Rollback:** nothing to roll back in production. The Preview is isolated to this branch. To withdraw it, close draft PR #6 and delete the branch alias in Vercel (or simply ignore it). If step 6A was run and should be undone, re-run `pilot-allow-preview.sh` with the previous preview origin. The old v1.2 UI remains intact on `feat/product-ui-v1-2` / `feat/pilot-vercel-ui`.
