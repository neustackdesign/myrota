# RELEASE CORRECTION — 8 October 2026

## Incident
The Cloudflare `myrota.neustackdesign.workers.dev` deployment displays the original placeholder Next.js landing page rather than the approved Brand v4 / MVP v1.2 interface. The visual implementation is already on draft PR #2 (`feat/product-ui-v1-2`), while the deployed Cloudflare build follows draft PR #1 (`infra/cloudflare-gate1`). Both PRs remain unmerged. A live infrastructure health check does not establish that the designed product has been released.

## The missed release invariant
**Every URL offered to a stakeholder for product review must serve the approved UI commit and must disclose whether data is simulated or real.** Never declare “myrota live” solely because `/api/health` and D1 work. Design fidelity and user journey checks are independent release gates.

## Corrected immediate release sequence
1. Prioritize an isolated **Vercel UI preview from the existing `feat/product-ui-v1-2` branch**, not from `main` and not from the placeholder infra branch. Keep `NEXT_PUBLIC_MYROTA_DEMO=1` for a clearly labelled interactive design preview. This preview is **not a functioning production skincare service** and must not process real user/private data. Auth claims must fail honestly.
2. Resolve the Vercel project's creation permission: the connected Neustack Hobby Vercel team does not currently list `myrota`, and attempts to create it through this connector returned HTTP 403. Owner must create/link `neustackdesign/myrota` manually in their Vercel dashboard or grant a connection with project-creation rights. Choose the Git production branch carefully; preserve production default and use a preview for the UI branch.
3. Once deployed, verify the exact Git SHA, no build errors, 375/430/desktop layouts, the 6 end-to-end demo journeys, and key branded assets against the supplied Brand v4 and Prototype v1.2. Missing licensed photography, exact master wordmark/marker/Grain/RotaSpot, and old app icons are **known visual blockers**, not a reason to falsely represent a final design.
4. Separate the **product runtime** decision. The full UI uses same-origin cookie-backed HTTP APIs. Deploying UI to Vercel and API to Cloudflare is NOT an automatic plug-and-play solution: cookies, CORS, CSRF, OAuth callbacks, relative /api paths, hostnames, and session continuity must be designed/tested. Use same-origin Vercel proxy/rewrite or unify UI and API on Cloudflare only after verifying that integration. **Do not merge both branches and call it done.**
5. Finish the existing live Cloudflare auth/shelf vertical slice separately, behind its Gate 1 acceptance test. Defer further platform churn; no new D1/Turnstile provisioning for the visual preview.
6. Before production release: resolve PR #2's four review issues (Turnstile, unknown format, cross-week spacing, npm lockfile), commit a single canonical lockfile after integration, run the 13 correctness scenarios, verify real data and auth, and replace provisional art/photos with licensed master assets.
7. Only after the integrated product passes design parity, auth/persistence, privacy, and failure-state checks should the public URL be described as **myrota product live**.

## Ownership and honest progress
- ChatGPT owns the bad sequence: it deployed the placeholder branch and repeatedly described infrastructure milestones as a near-finished live product; it then expanded bootstrap rather than first publishing the finished UI as a preview.
- Claude Code did implement a substantial UI and demo on PR #2, but it is **not deployed** and some identity assets are provisional. Its 18 tests passed locally according to its report, not automatically proof of GitHub end-to-end runtime.
- GitHub CI proves builds/tests as configured, not visual fidelity or end-to-end production availability.
- Current Vercel tool cannot create the project (403). This is an authorization boundary, not a missing shell command that ChatGPT should ask the user to repeat blindly.

## Never repeat
- No platform pivot without explicitly recording the user decision and the concrete goal it serves.
- No backend Gate 1 as prerequisite to visually reviewing a working UI demo.
- No “just one last step” prediction without a verified acceptance test.
- Never swap branches in a deploy process without announcing the *exact source SHA and expected visible UI*.
- Freeze interfaces and minimize developer shell commands; diagnose failures before telling the user to retry.


## Update — UI preview deployment now READY
- The user linked the existing `myrota` Vercel project under `neustackdesign-gmailcoms-projects` from the local `~/Code/myrota` checkout of `feat/product-ui-v1-2`.
- `vercel deploy --build-env NEXT_PUBLIC_MYROTA_DEMO=1` returned **Ready in 37s** and a Preview URL. This is an actual Vercel deployment, not the Cloudflare infrastructure placeholder. Vercel Authentication is enabled for the deployment.
- This is **deployment evidence only**, not a rendered-design audit. Do not mark Brand v4 visual parity or the six end-to-end flows passed without inspecting the actual authenticated preview.
- Vercel connector access from this chat currently returns 404 project not found / 403 deployment list for this account/project, even though the user's owner-authenticated local Vercel CLI can access and deploy. This is a **tool-authorization mismatch**, not evidence the preview failed.
- `--build-env NEXT_PUBLIC_MYROTA_DEMO=1` is a per-deployment build value, **not a persisted Preview environment setting**. Before automatic future branch builds, persist `NEXT_PUBLIC_MYROTA_DEMO=1` on the `feat/product-ui-v1-2` preview branch only. Production must never enable demo fixtures.
- No PR has been merged; no integration with real Cloudflare backend has been verified. The preview must remain explicitly labelled DEMO and subject to Vercel authentication until review.
