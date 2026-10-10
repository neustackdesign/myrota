import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontLabel } from "../../lib/server/extract-front";

const sample = JSON.stringify({
  visible_text: "Minimalist Polyhydroxy Acid (PHA) 03% FACE TONER with multi-biotics 150 mL / 5 fl. oz.",
  brand: "Minimalist",
  name: "Polyhydroxy Acid (PHA) 03% Face Toner",
  category: "toner",
  size: "150 mL",
});

test("clear user front label identifies product without inventing formula or barcode", () => {
  assert.deepEqual(parseFrontLabel(sample), {
    brand: "Minimalist",
    name: "Polyhydroxy Acid (PHA) 03% Face Toner",
    category: "toner",
    variant: "150 mL",
    visibleText: "Minimalist Polyhydroxy Acid (PHA) 03% FACE TONER with multi-biotics 150 mL / 5 fl. oz.",
  });
});

test("rejects unsupported product names rather than hallucinating a match", () => {
  assert.equal(parseFrontLabel(JSON.stringify({
    visible_text: "Minimalist Polyhydroxy Acid 03% Face Toner 150ml",
    brand: "Minimalist", name: "Retinol 2% Night Cream", category: "toner",
  })), null);
});

test("model cannot assert an unseen category, brand or size", () => {
  const r = parseFrontLabel(JSON.stringify({
    visible_text: "PHA 3% Face Toner",
    brand: "Another Brand", name: "PHA 3% Face Toner", category: "serum", size: "200 ml",
  }));
  assert.ok(r);
  assert.equal(r.brand, null);
  assert.equal(r.category, null);
  assert.equal(r.variant, null);
});

test("no usable front label and malformed model JSON fail closed", () => {
  assert.equal(parseFrontLabel("UNREADABLE"), null);
  assert.equal(parseFrontLabel("What a lovely serum"), null);
  assert.equal(parseFrontLabel('{"name":"Niacinamide Serum","brand":"Example"}'), null);
});
