import { test } from "node:test";
import assert from "node:assert/strict";
import { draftFromCatalogue, draftForUnknown } from "../../lib/client/drafts";
import type { CatalogueProduct } from "../../lib/domain/types";

const listing: CatalogueProduct = {
  catalogueId: "source:sample-123",
  brand: "Example",
  name: "Vitamin C Serum",
  category: "serum",
  format: "leave_on",
  identityKey: "example:vitamin-c-serum",
  variant: "30ml",
  inciStatus: "verified",
  ingredients: [{
    id: "inci-1",
    text: "Ascorbic Acid",
    status: "verified",
    activeClass: "vitamin_c",
    flagged: true,
  }],
};

test("unreviewed catalogue data can never promote an ingredient into a verified active", () => {
  const draft = draftFromCatalogue(listing);
  assert.equal(draft.source, "search");
  assert.equal(draft.catalogueId, listing.catalogueId);
  assert.equal(draft.identityStatus, "user_confirmed");
  assert.equal(draft.identityKey, null);
  assert.equal(draft.inciStatus, "partial");
  assert.equal(draft.ingredients[0].status, "read");
  assert.equal(draft.ingredients[0].activeClass, null);
  assert.equal(draft.ingredients[0].flagged, false);
});

test("catalogue listing without ingredients remains unknown", () => {
  const draft = draftFromCatalogue({ ...listing, ingredients: [] });
  assert.equal(draft.inciStatus, "unknown");
  assert.deepEqual(draft.ingredients, []);
});

test("manual product classification preserves unknown ingredient evidence and the user's chosen session", () => {
  const draft = draftForUnknown("My evening cleanser", "pm", "cleanser", "rinse_off");
  assert.equal(draft.name, "My evening cleanser");
  assert.equal(draft.category, "cleanser");
  assert.equal(draft.format, "rinse_off");
  assert.equal(draft.placement, "pm");
  assert.equal(draft.identityStatus, "unknown");
  assert.equal(draft.inciStatus, "unknown");
  assert.deepEqual(draft.ingredients, []);
});
