# Clinical rule foundation — review dependency

## Audit of the production ruleset
`lib/server/rota-store.ts` builds every rota with `NO_CLINICAL_RULES` (empty `pairRules`/`timingRules`/`contextHoldRules`). The domain engine accepts only rules whose status is in `PRODUCTION_ACCEPTED = ["reviewed"]`. Consequences today, unchanged by this work:
- **Mix Check** returns `insufficient_evidence` for any active pair — never a confident "Fine together".
- **Rota** places user-chosen AM/PM ordering but holds/does not schedule actives by any clinical rule; it explains what was and was not checked.

This is correct and must stay true until real review happens.

## Prepared for review (NOT approved)
`lib/server/draft-rules.ts` → `DRAFT_RULESET` contains candidate pair/timing/context-hold rules, each:
- `status: "draft"`, `reviewers: []` (no attribution),
- `evidenceRefs` with starting references + explicit `REVIEW-NEEDED` notes.

It is **not imported by any production path**. Test `tests/backend/draft-rules.test.ts` locks that every rule is unreviewed and that `draft` is never production-accepted.

## What a reviewer must do (release dependency)
A named pharmacist or dermatologist must, per rule:
1. Confirm the verdict/threshold wording and exceptions (e.g. adapalene is stable with BPO; retinoid titration for new users).
2. Replace each `REVIEW-NEEDED` ref with an authoritative citation.
3. Set `status: "reviewed"` and add a `Reviewer { name, role, reviewedAt }`.
4. Bump the rule `version`.

Only then may the reviewed subset be wired into the production rota builder. An OCR reading, a catalogue listing, or a user correction must **never** be promoted to reviewed evidence.

## Enabling later
When a reviewed subset exists, construct the production `RuleSet` from the reviewed rules and pass it where `NO_CLINICAL_RULES` is used today. No domain changes are required — the acceptance gate already enforces status.
