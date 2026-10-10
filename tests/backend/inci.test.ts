import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInciName, detectActiveClass, toInciIngredients, splitInciList } from "../../lib/server/inci";

test("normalizeInciName strips percentages, parentheticals, casing, punctuation", () => {
  assert.equal(normalizeInciName("Retinol (Vitamin A) 1%"), "retinol");
  assert.equal(normalizeInciName("AQUA (WATER)"), "aqua");
  assert.equal(normalizeInciName("  Niacinamide ,"), "niacinamide");
  assert.equal(normalizeInciName("Salicylic Acid*"), "salicylic acid");
});

test("detectActiveClass only tags established, unambiguous actives", () => {
  assert.equal(detectActiveClass("retinol"), "retinoid");
  assert.equal(detectActiveClass("niacinamide"), "niacinamide");
  assert.equal(detectActiveClass("salicylic acid"), "bha");
  assert.equal(detectActiveClass("ascorbic acid"), "vitamin_c");
  assert.equal(detectActiveClass("glycolic acid"), "aha");
  assert.equal(detectActiveClass("azelaic acid"), "azelaic_acid");
  assert.equal(detectActiveClass("benzoyl peroxide"), "benzoyl_peroxide");
  assert.equal(detectActiveClass("aqua"), null);
  assert.equal(detectActiveClass("glycerin"), null);
  assert.equal(detectActiveClass("citric acid"), null);
  assert.equal(detectActiveClass("fragrance"), null);
});

test("synonyms resolve to the canonical active", () => {
  assert.equal(detectActiveClass("vitamin c"), "vitamin_c");
  assert.equal(detectActiveClass("granactive retinoid"), "retinoid");
  assert.equal(detectActiveClass("vitamin b3"), "niacinamide");
});

test("toInciIngredients reads status, never invents, flags unreadable", () => {
  const out = toInciIngredients(["Niacinamide", "Aqua", "   ", "@@"]);
  assert.equal(out.length, 4);
  assert.equal(out[0].status, "read");
  assert.equal(out[0].activeClass, "niacinamide");
  assert.equal(out[1].activeClass, null);
  assert.equal(out[2].status, "unreadable");
  assert.equal(out[3].status, "unreadable");
});

test("hallucination guard: every output ingredient text comes from the input", () => {
  const input = ["Aqua", "Retinol", "Tocopherol"];
  const out = toInciIngredients(input);
  for (const ing of out) assert.ok(input.includes(ing.text), `invented: ${ing.text}`);
  assert.equal(out.length, input.length);
});

test("splitInciList splits only at deterministic separators and caps", () => {
  assert.deepEqual(splitInciList("Ingredients: Aqua, Glycerin; Niacinamide\nRetinol"),
    ["Aqua", "Glycerin", "Niacinamide", "Retinol"]);
  assert.equal(splitInciList("").length, 0);
  assert.ok(splitInciList(Array(500).fill("Aqua").join(",")).length <= 200);
});

test("splitInciList preserves numbered INCI names like 1,2-Hexanediol", () => {
  assert.deepEqual(splitInciList("Aqua, 1,2-Hexanediol, Niacinamide, Salicylic Acid"),
    ["Aqua", "1,2-Hexanediol", "Niacinamide", "Salicylic Acid"]);
});
