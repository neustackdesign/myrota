# Implementation plan — myrota

**Branch split**: ChatGPT `infra/cloudflare-gate1` owns Cloudflare runtime, D1/Auth, migrations and CI. Claude Code `feat/product-ui-v1-2` owns approved Brand v4 UI, interaction states and pure TS domain/tests. Neither merges directly to main until reconciled and verified.

## Completed
- [x] Existing Next.js 16 PWA scaffold, provisional 15 product fixtures, pure domain library, placeholder UI
- [x] Existing Next.js CI and synthetic benchmark-evaluator tests (not proof of OCR)
- [x] Product visual and interaction direction approved in Claude Design v1.2
- [x] Cloudflare decision and governance written into `CLAUDE.md`
- [x] Added 13-scenario correctness contract and 30-real-label requirements

## Gate 1 — foundation (NOW)
- [ ] Next.js typecheck + build remain green on latest main
- [ ] Vinext compatibility report, non-destructive init, parallel build, local routes
- [ ] Cloudflare Worker deployed with actual URL (needs authenticated Cloudflare account)
- [ ] Independent D1 database created (needs authenticated account), migrated and verified
- [ ] Better Auth anonymous guest, Google and Brevo email OTP configured
- [ ] Guest→new and guest→existing Google account safe merge, idempotent
- [ ] Authenticated shelf write/read, isolation between user A and B
- [ ] Real route CPU p50/p95; decide Free versus $5 Workers Paid; no unapproved charge

## Gate 2 — product intelligence
- [ ] Real scan/gallery/paste/search → structured candidate extraction/review
- [ ] D1 provenance, INCI dictionary, reviewed rules and regulator alerts
- [ ] Benchmark 30 real labels with neurons/scan and latency/cost; quality gate

## Gate 3 — integrity
- [ ] All 13 contract regression scenarios green
- [ ] Real date-aware 04:00 boundary, 48h Rescue, weekly archive, joint Friend Streak
- [ ] No unreviewed medical guidance shown

## Gate 4 — activation and growth
- [ ] Real token join and two-sided Friend Streak
- [ ] OG/share cards and WhatsApp, real safe invite links
- [ ] Web Push and iOS/Android PWA installation/session tests
- [ ] Production screenshots parity to Brand v4 and Claude Design

## Gate 5 — release
- [ ] Verified final photos rights, evidence review, unit/integration/manual tests
- [ ] No insecure auth/rule fallbacks; no secret leakage; free-tier alarms
- [ ] First 10 real pilot users (target 16 Oct subject to gates)

## Blockers (do not bluff)
- Cloudflare login and project provisioning cannot be done with the available GitHub/Supabase connectors alone.
- Google OAuth, Brevo API credentials and DNS will require existing provider access or user action.
- Latest final v1.2 design files are local conversation files, not yet copied into GitHub; Claude Code will receive them from the user.
- Real 30-label image set and clinician reviewer signoff are not yet provided.
