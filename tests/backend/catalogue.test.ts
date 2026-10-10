import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCatalogue, getCatalogueRecord, catalogueSize, canonicalGtin, findCatalogueByBarcode } from "../../lib/server/catalogue-store";

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

test("exact GTIN lookup resolves existing OBF product without interpreting a numeric query as a name", () => {
  const code = "3606000637535";
  const product = findCatalogueByBarcode(code);
  assert.ok(product, "known CeraVe barcode should be indexed");
  assert.equal(product!.identityKey, code);
  assert.deepEqual(searchCatalogue(code), [product]);
  assert.equal(product!.inciStatus, "partial", "barcode never grants clinical certainty");
});

test("UPC / EAN / GTIN-14 variants normalize to the same identifier, invalid checksums fail closed", () => {
  const canonical = canonicalGtin("3606000637535");
  assert.equal(canonical, "03606000637535");
  assert.equal(canonicalGtin("03606000637535"), canonical);
  assert.equal(findCatalogueByBarcode("03606000637535")?.catalogueId,
    findCatalogueByBarcode("3606000637535")?.catalogueId);
  assert.equal(canonicalGtin("3606000637536"), null);
  assert.equal(canonicalGtin("EAN3606000637535"), null);
  assert.equal(canonicalGtin("360600063753"), null);
  assert.equal(canonicalGtin("3606000637535999"), null);
  assert.equal(searchCatalogue("3606000637536").length, 0);
});

test("unknown but well-formed GTIN does not guess an adjacent product", () => {
  assert.equal(findCatalogueByBarcode("12345670"), null);
});

test("Minimalist PHA toner can be discovered by front-label text without pretending to know the SKU", () => {
  const matches = searchCatalogue("Polyhydroxy Acid").filter((p) => p.brand === "Minimalist");
  assert.equal(matches.length, 2, "UAE/global and India declarations are distinct");
  for (const match of matches) {
    assert.equal(match.identityKey, null, "no product barcode was observed");
    assert.equal(match.inciStatus, "partial", "manufacturer declaration is not confirmed label INCI");
    assert.ok(match.ingredients.length > 30, "official source has declared ingredient text");
    const record = getCatalogueRecord(match.catalogueId);
    assert.ok(record);
    assert.equal(record!.provenance.level, "source_listed");
    assert.ok(record!.provenance.sourceUrl.startsWith("https://"));
  }
  assert.notDeepEqual(matches[0].ingredients.map((i) => i.text),
    matches[1].ingredients.map((i) => i.text),
    "different regional official formulations must not be merged");
});
