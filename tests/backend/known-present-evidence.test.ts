import { test } from "node:test";
import assert from "node:assert/strict";
import { detectActiveClass, normalizeInciName } from "../../lib/server/inci";
import { knownPresentActiveClasses, evidenceActiveClasses } from "../../lib/domain/evidence";
import { isStrongActive } from "../../lib/domain/types";

const det = (n: string) => detectActiveClass(normalizeInciName(n));

test("ontology now covers PHA and UV filters", () => {
  assert.equal(det("Gluconolactone"), "pha");
  assert.equal(det("Lactobionic Acid"), "pha");
  assert.equal(det("Avobenzone"), "uv_filter");
  assert.equal(det("Ethylhexyl Methoxycinnamate"), "uv_filter");
  assert.equal(det("Octocrylene"), "uv_filter");
  assert.equal(det("Zinc Oxide"), "uv_filter");
  // existing classes unchanged
  assert.equal(det("Salicylic Acid"), "bha");
  assert.equal(det("Lactic Acid"), "aha");
  assert.equal(det("Retinol"), "retinoid");
});

test("strong actives are retinoid/aha/bha/pha/bpo; uv_filter and niacinamide are not", () => {
  for (const c of ["retinoid", "aha", "bha", "pha", "benzoyl_peroxide"] as const) assert.ok(isStrongActive(c), c);
  for (const c of ["uv_filter", "niacinamide", "vitamin_c", "azelaic_acid"] as const) assert.ok(!isStrongActive(c), c);
});

const ing = (text: string, active: string | null) => ({ id: text, text, status: "read" as const, activeClass: active as never, normalized: text.toLowerCase(), flagged: false });

test("knownPresentActiveClasses counts actives from a PARTIAL list (no full INCI required)", () => {
  // a partial photo: salicylic acid read, rest unknown — still known-present BHA
  const partial = { inciStatus: "partial" as const, ingredients: [ing("Aqua", null), ing("Salicylic Acid", "bha"), ing("Gluconolactone", "pha")], labelActives: [] };
  assert.deepEqual(knownPresentActiveClasses(partial).sort(), ["bha", "pha"]);
  // the strict full-formula helper still refuses partial
  assert.deepEqual(evidenceActiveClasses(partial), []);
});

test("knownPresentActiveClasses also uses classified labelActives (Drug Facts)", () => {
  const shiseido = {
    inciStatus: "unknown" as const,
    ingredients: [] as never[],
    labelActives: [
      { name: "Avobenzone", percentage: 2.5, activeClass: "uv_filter" as const },
      { name: "Octocrylene", percentage: 10, activeClass: "uv_filter" as const },
    ],
  };
  assert.deepEqual(knownPresentActiveClasses(shiseido), ["uv_filter"]);
});

test("known-present never derives absence: an omitted ingredient is not reported", () => {
  const partial = { inciStatus: "partial" as const, ingredients: [ing("Niacinamide", "niacinamide")], labelActives: [] };
  const found = knownPresentActiveClasses(partial);
  assert.ok(found.includes("niacinamide"));
  assert.ok(!found.includes("retinoid")); // not present, not inferred either way
});
