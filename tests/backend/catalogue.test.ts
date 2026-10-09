import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCatalogue, getCatalogueRecord, catalogueSize } from "../../lib/server/catalogue-store";

test("catalogue is a real, non-trivial starter set", () => {
  assert.ok(catalogueSize >= 100, `expected >=100 products, got ${catalogueSize}`);
});

test("search returns genuine, provenance-bearing, NON-verified results", () => {
  const results = searchCatalogue("cerave");
  assert.ok(results.length > 0, "expected CeraVe matches");
  for (const r of results) {
    assert.match(r.brand.toLowerCase(), /cerave/);
    assert.equal(r.inciStatus, "partial");
    assert.ok(r.identityKey && /^\d{8,14}$/.test(r.identityKey), "identityKey must be a real barcode");
    for (const ing of r.ingredients) assert.notEqual(ing.status, "verified");
  }
});

test("bounded queries: empty / too-short return nothing", () => {
  assert.equal(searchCatalogue("").length, 0);
  assert.equal(searchCatalogue("a").length, 0);
  assert.equal(searchCatalogue("   ").length, 0);
});

test("multi-token search requires every token to match", () => {
  for (const r of searchCatalogue("cerave cleanser")) {
    const hay = `${r.brand} ${r.name}`.toLowerCase();
    assert.ok(hay.includes("cerave") && hay.includes("cleanser"));
  }
  assert.equal(searchCatalogue("cerave zzzzqqnotarealword").length, 0);
});

test("getCatalogueRecord resolves server-side provenance and rejects unknown ids", () => {
  const sample = searchCatalogue("la roche-posay")[0];
  assert.ok(sample, "expected a sample");
  const record = getCatalogueRecord(sample.catalogueId);
  assert.ok(record, "known catalogueId must resolve");
  assert.equal(record!.provenance.level, "source_listed");
  assert.match(record!.provenance.sourceUrl, /^https:\/\//);
  assert.equal(getCatalogueRecord("obf:does-not-exist"), null);
});

test("result count is bounded", () => {
  assert.ok(searchCatalogue("a cream", 50).length <= 50);
});
