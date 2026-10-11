import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontLabel, parseLabelActives } from "../../lib/server/extract-front";

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
    labelActives: [],
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

test("real Shiseido Clear Sunscreen Stick Drug Facts retains four labelled UV actives", () => {
  const raw = JSON.stringify({
    visible_text: "SHISEIDO CLEAR SUNSCREEN STICK Active ingredients\nAVOBENZONE 2.5%\nHOMOSALATE 10.0%\nOCTISALATE 5.0%\nOCTOCRYLENE 10.0%\nSHISEIDO AMERICAS CORPORATION DIST. MADE IN U.S.A. 20g NET WT .7 OZ OPEN",
    brand: "Shiseido",
    name: "Clear Sunscreen Stick",
    category: "sunscreen",
    size: "20g",
  });
  const product = parseFrontLabel(raw);
  assert.ok(product);
  assert.equal(product.brand, "Shiseido");
  assert.equal(product.name, "Clear Sunscreen Stick");
  assert.deepEqual(product.labelActives, [
    { name: "Avobenzone", percentage: 2.5 },
    { name: "Homosalate", percentage: 10 },
    { name: "Octisalate", percentage: 5 },
    { name: "Octocrylene", percentage: 10 },
  ]);
});

test("does not promote SPF, percent marketing claims or unheaded ingredients to Drug Facts", () => {
  assert.deepEqual(parseLabelActives("PHA 3% Face Toner with Niacinamide 5%"), []);
  assert.deepEqual(parseLabelActives("Avobenzone 2.5% Homosalate 10.0%"), []);
  assert.deepEqual(parseLabelActives("Active ingredients: Avobenzone 2.5%, Hydroquinone 7%"), [
    { name: "Avobenzone", percentage: 2.5 },
  ]);
});
