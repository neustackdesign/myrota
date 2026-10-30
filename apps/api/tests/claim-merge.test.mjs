import { test } from "node:test";
import assert from "node:assert/strict";
import { planAccountMerge } from "../lib/server/claim-merge.ts";

const base = () => ({
  guestUserId: "guest",
  targetUserId: "claimed",
  guestShelf: [], targetShelf: [],
  guestDays: [], targetDays: [],
  guestPairs: [], targetPairs: [],
  guestInvites: [], targetInvites: [],
});
const shelf = (id, ownerUserId, identityKey = null) => ({
  id, ownerUserId, identityKey,
  brand: "Brand", productName: "Product",
  productType: "Serum", identityConfidence: "partial",
  ingredientConfidence: "unknown", evidenceRefs: [id],
});
const day = (id, ownerUserId, status, completionEventId) => ({
  id, ownerUserId, skincareDate: "2026-10-08", timeZone: "Africa/Lagos",
  status, completionEventId,
});

test("real duplicate SKU is deduplicated, unverified identity is never fuzzily merged", () => {
  const x = base();
  x.targetShelf = [shelf("old", "claimed", "sku-1"), shelf("oldunknown", "claimed")];
  x.guestShelf = [shelf("guestduplicate", "guest", "sku-1"), shelf("guestunknown", "guest")];
  const result = planAccountMerge(x);
  assert.equal(result.shelf.length, 3);
  assert.deepEqual(result.shelf[0].evidenceRefs, ["old", "guestduplicate"]);
  assert.equal(result.shelf[0].ingredientConfidence, "unknown");
  assert.ok(result.shelf.every(item => item.ownerUserId === "claimed"));
});

test("completed wins missed only if supported by a real completion event", () => {
  const x = base();
  x.targetDays = [day("miss", "claimed", "missed")];
  x.guestDays = [day("done", "guest", "completed", "event-1")];
  assert.equal(planAccountMerge(x).days[0].status, "completed");
  x.guestDays = [day("unproven", "guest", "completed")];
  const result = planAccountMerge(x);
  assert.equal(result.days[0].status, "missed");
  assert.equal(result.warnings.length, 1);
});

test("union of pairs/tokens remaps guest, dedups pairs and excludes self pairing", () => {
  const x = base();
  x.targetPairs = [{ id: "pair-old", memberA: "claimed", memberB: "friend1" }];
  x.guestPairs = [
    { id: "pair-duplicate", memberA: "friend1", memberB: "guest" },
    { id: "pair-new", memberA: "guest", memberB: "friend2" },
    { id: "pair-self", memberA: "guest", memberB: "claimed" },
  ];
  x.targetInvites = [{ token: "A", inviterId: "claimed" }];
  x.guestInvites = [{ token: "B", inviterId: "guest" }];
  const merged = planAccountMerge(x);
  assert.equal(merged.pairs.length, 2);
  assert.equal(merged.invites.length, 2);
  assert.ok(merged.invites.every(inv => inv.inviterId === "claimed"));
  assert.ok(merged.warnings.some(w => w.includes("self-pair")));
});

test("no streak counter or sensitive context enters merged output", () => {
  const x = base();
  x.guestShelf = [shelf("one", "guest")];
  x.safetyContext = { pregnant: true };
  x.streak = 100;
  const merged = planAccountMerge(x);
  assert.equal(merged.requiresStreakRecompute, true);
  assert.equal(merged.requiresLocalSafetyContextReconfirmation, true);
  assert.equal("safetyContext" in merged, false);
  assert.equal("streak" in merged, false);
  assert.equal(JSON.stringify(merged).includes("pregnant"), false);
});

test("unrelated shelf or social data rejected", () => {
  const x = base();
  x.guestShelf = [shelf("bad", "unrelated")];
  assert.throws(() => planAccountMerge(x), /unrelated identity/);
});

test("same date in different user timezones remains distinguishable for reconciliation", () => {
  const x = base();
  x.targetDays = [day("lagos", "claimed", "completed", "e1")];
  x.guestDays = [{ ...day("dubai", "guest", "completed", "e2"), timeZone: "Asia/Dubai" }];
  assert.equal(planAccountMerge(x).days.length, 2);
});
