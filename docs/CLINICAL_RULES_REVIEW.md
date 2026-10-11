# Clinical claims and consumer routine guidance — separate tracks

## Current operating authority (11 Oct 2026)

Issue #19 is the binding product specification. **Consumer skincare routine planning does not wait on a clinical reviewer.** General category layering, known-present ingredient categorisation, directly attributed package usage directions and editable ordinary skincare scheduling suggestions may ship transparently with published support, clear assumptions and no clinical endorsement claim.

This document governs **clinically consequential assertions** only: prescriptions/treatments, regulated claims, pregnancy/breastfeeding-specific risks, contraindications, and similar high-stakes recommendations. Those must not be presented as reviewed medical facts without appropriate authority. Incomplete INCI does not erase observed actives; equally, it never verifies whole-product safety.

The empty-rules/no-active planner described below is a verified *defect to fix* for consumer routine purposes, not behaviour to preserve. Medical/therapeutic claims can remain gated independently.

## Historical audit of the production ruleset
`lib/server/rota-store.ts` builds every rota with `NO_CLINICAL_RULES` (empty `pairRules`/`timingRules`/`contextHoldRules`). The domain engine accepts only rules whose status is in `PRODUCTION_ACCEPTED = ["reviewed"]`. Consequences today, unchanged by this work:
- **Mix Check** returns `insufficient_evidence` for any active pair — never a confident "Fine together".
- **Rota** places user-chosen AM/PM ordering but holds/does not schedule actives by any clinical rule; it explains what was and was not checked.

This was originally accepted as a blanket safety design, but it **fails the actual product promise**. It is no longer an acceptable reason for all ordinary consumer schedules to exclude known-present actives. Preserve caution for unsupported medical claims only; apply Issue #19's routine engine requirements.

## Prepared for review (NOT approved)
`lib/server/draft-rules.ts` → `DRAFT_RULESET` contains candidate pair/timing/context-hold rules, each:
- `status: "draft"`, `reviewers: []` (no attribution),
- `evidenceRefs` with starting references + explicit `REVIEW-NEEDED` notes.

It is **not imported by any production path**. Test `tests/backend/draft-rules.test.ts` locks that every rule is unreviewed and that `draft` is never production-accepted.

## What a reviewer must do (only when proposing an authoritative clinical claim — not an ordinary-routine release dependency)
A named pharmacist or dermatologist must, per rule:
1. Confirm the verdict/threshold wording and exceptions (e.g. adapalene is stable with BPO; retinoid titration for new users).
2. Replace each `REVIEW-NEEDED` ref with an authoritative citation.
3. Set `status: "reviewed"` and add a `Reviewer { name, role, reviewedAt }`.
4. Bump the rule `version`.

Only then may the **clinically consequential** reviewed subset be represented as professionally reviewed in the Rota. Separately versioned **nonmedical consumer routine guidance can be enabled without that reviewer**, must be labelled as general guidance and sourced appropriately. An OCR reading or user correction confirms *observed content*, never clinician review or verified full-formula safety.

## Enabling later
Do not wait for that subset to ship ordinary cosmetic guidance. Connect a separately typed/versioned general-routine policy for layering, user-confirmed source instructions and explainable editable scheduling; reserve the `reviewed` status/attribution for actual clinical sign-offs. Confirm live Mix and Rota use compatible evidence and rulepacks. The engine and evidence types **will** require changes to support this distinction; see Issue #19.
