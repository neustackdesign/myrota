import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage, looksLikeIngredientList } from "../../lib/server/extract-validate";

const bytes = (...b: number[]) => Uint8Array.from(b);

test("sniffImage accepts real JPEG/PNG/WebP signatures only", () => {
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0)), "jpeg");
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0)), "png");
  assert.equal(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)), "webp");
});

test("sniffImage rejects spoofed/non-image content", () => {
  // a PDF / script / text file renamed to .jpg must be rejected
  assert.equal(sniffImage(bytes(0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0)), null); // %PDF
  assert.equal(sniffImage(bytes(0x3c, 0x73, 0x76, 0x67)), null); // <svg (too short + wrong)
  assert.equal(sniffImage(new Uint8Array(0)), null);
});

test("looksLikeIngredientList accepts a real INCI list, rejects prose/empty", () => {
  assert.equal(looksLikeIngredientList(
    "Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Phenoxyethanol",
    ["Aqua", "Glycerin", "Niacinamide", "Sodium Hyaluronate", "Phenoxyethanol"]), true);
  // model refusal / prose with no ingredient tokens
  assert.equal(looksLikeIngredientList("I cannot read this label clearly", ["I cannot read this label clearly"]), false);
  assert.equal(looksLikeIngredientList("", []), false);
  // two vague words are not a list
  assert.equal(looksLikeIngredientList("face cream", ["face cream"]), false);
});

test("front-label active claims are not mistaken for an INCI declaration", () => {
  const headline = "Polyhydroxy Acid, Amino Acids, Polyglutamic Acid";
  assert.equal(looksLikeIngredientList(headline, headline.split(", ")), false);
});
