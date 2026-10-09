import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAFT_RULESET } from "../../lib/server/draft-rules";
import { PRODUCTION_ACCEPTED } from "../../lib/domain/types";

test("every draft rule is unreviewed and cannot pass as reviewed", () => {
  const all = [
    ...DRAFT_RULESET.pairRules,
    ...DRAFT_RULESET.timingRules,
    ...DRAFT_RULESET.contextHoldRules,
  ];
  assert.ok(all.length > 0, "there should be draft rules prepared for review");
  for (const rule of all) {
    assert.equal(rule.status, "draft", `${rule.id} must be draft, not approved`);
    assert.equal(rule.reviewers.length, 0, `${rule.id} must have no reviewer attribution yet`);
    assert.ok(rule.evidenceRefs.length > 0, `${rule.id} must carry evidence refs for review`);
  }
});

test("production never accepts draft rules", () => {
  assert.ok(!PRODUCTION_ACCEPTED.includes("draft"));
  assert.deepEqual([...PRODUCTION_ACCEPTED], ["reviewed"]);
});
