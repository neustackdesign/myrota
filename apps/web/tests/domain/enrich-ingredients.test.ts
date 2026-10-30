import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEnrichedIngredients } from "../../lib/client/drafts";
import type { ExtractionCandidate } from "../../lib/api/contract";

// A product whose front label was recognised, but whose INCI list has not been
// read yet — exactly the "Ingredients not yet read" state on review Step 2.
const identified: ExtractionCandidate = {
  extractionId: "front-123",
  brand: "Example",
  name: "Facial Moisturizing Lotion SPF 30",
  category: "sunscreen",
  format: "leave_on",
  identityStatus: "user_confirmed",
  inciStatus: "unknown",
  identityKey: "example:spf30",
  variant: "50ml",
  ingredients: [],
  flags: [],
  provider: "front-label",
};

// What /api/extract returns from the pasted/typed INCI text.
const read: ExtractionCandidate = {
  extractionId: "paste-789",
  brand: null,
  name: null,
  category: null,
  format: null,
  identityStatus: "unknown",
  inciStatus: "verified", // even if the read claims verified, enrich must not promote
  identityKey: null,
  variant: null,
  ingredients: [
    { id: "i1", text: "Aqua", status: "read", activeClass: null, flagged: false },
    { id: "i2", text: "Avobenzone", status: "read", activeClass: null, flagged: false },
  ],
  flags: [],
  provider: "paste",
};

test("enrich keeps the reviewed front identity and never overwrites it", () => {
  const merged = mergeEnrichedIngredients(identified, read);
  assert.equal(merged.brand, "Example");
  assert.equal(merged.name, "Facial Moisturizing Lotion SPF 30");
  assert.equal(merged.category, "sunscreen");
  assert.equal(merged.format, "leave_on");
  assert.equal(merged.identityKey, "example:spf30");
  assert.equal(merged.identityStatus, "user_confirmed");
  assert.equal(merged.variant, "50ml");
});

test("enrich attaches the new ingredients but caps provenance at partial", () => {
  const merged = mergeEnrichedIngredients(identified, read);
  assert.deepEqual(merged.ingredients.map((i) => i.text), ["Aqua", "Avobenzone"]);
  assert.equal(merged.inciStatus, "partial"); // never "verified", even though read said so
  assert.ok(merged.ingredients.every((i) => i.status !== "verified"));
  assert.equal(merged.extractionId, "paste-789"); // links to the read that produced the list
  assert.equal(merged.provider, "paste");
});
