#!/usr/bin/env node
/**
 * Build the photo-OCR benchmark fixture set from Open Beauty Facts.
 *
 * "Genuine, independently checked" = real product ingredient-label PHOTOGRAPHS
 * contributed and transcribed by the OBF community (ODbL), each with the declared
 * INCI text as ground truth and a real barcode. We never ship the images in git;
 * we store URLs + ground-truth INCI so the harness fetches transiently at run time.
 *
 * This PREPARES the benchmark; it does NOT enable photo reading. Enabling requires
 * the harness to meet docs/INGESTION_BENCHMARK.md thresholds on a deployed model.
 *
 *   node scripts/ingest/build-ocr-benchmark.mjs            # writes tests/fixtures/ocr-benchmark.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UA = "myrota-pilot/0.1 (ocr benchmark prep; contact lionproductteam@gmail.com)";
const OBSERVED_AT = process.env.OBSERVED_AT || new Date().toISOString().slice(0, 10);
const TARGET = Number(process.argv.includes("--target") ? process.argv[process.argv.indexOf("--target") + 1] : 30);
// Nigeria / UAE / GCC availability + a few difficult cases (small type, glossy).
const BRANDS = ["the-ordinary", "cerave", "la-roche-posay", "cetaphil", "neutrogena", "nivea", "garnier", "bioderma", "eucerin", "avene", "the-inkey-list", "cosrx"];

async function brand(b) {
  const url = `https://world.openbeautyfacts.org/api/v2/search?brands_tags=${b}` +
    `&fields=code,product_name,brands,ingredients_text&page_size=60`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  return r.ok ? (await r.json()).products || [] : [];
}

// The search endpoint omits image_ingredients_url; the product endpoint has it.
async function ingredientImage(code) {
  const r = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${code}?fields=image_ingredients_url`, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  return (await r.json())?.product?.image_ingredients_url || null;
}

const seen = new Set();
const items = [];
for (const b of BRANDS) {
  process.stderr.write(`${b}… `);
  let ps = []; try { ps = await brand(b); } catch {}
  let kept = 0;
  for (const p of ps) {
    const code = String(p.code || "");
    const name = String(p.product_name || "").trim();
    const inci = String(p.ingredients_text || "").trim();
    // Need a real barcode, name, and a declared INCI (ground truth) first.
    if (!/^\d{8,14}$/.test(code) || name.length < 3 || inci.length < 25 || seen.has(code)) continue;
    const groundTruth = inci.replace(/^\s*ingredients?\s*[:：]\s*/i, "").split(/[,;\n·•]+/).map((x) => x.trim()).filter((x) => x.length >= 2);
    if (groundTruth.length < 5) continue;
    seen.add(code);
    // Then confirm a real ingredient-label photograph exists.
    const img = await ingredientImage(code);
    if (!img) continue;
    items.push({
      barcode: code,
      brand: (p.brands || b).split(",")[0].trim(),
      name: name.slice(0, 120),
      imageUrl: img, // fetched transiently at run time; never committed
      groundTruthInci: groundTruth.slice(0, 60),
      source: "openbeautyfacts",
      sourceUrl: `https://world.openbeautyfacts.org/product/${code}`,
      license: "ODbL-1.0",
      observedAt: OBSERVED_AT,
    });
    kept++;
    if (kept >= 3 || items.length >= TARGET) break; // spread across brands
  }
  process.stderr.write(`+${kept} (${items.length})\n`);
  if (items.length >= TARGET) break;
}

const out = {
  generatedAt: OBSERVED_AT,
  note: "OCR benchmark fixtures. Real OBF community label photos (ODbL) + declared INCI ground truth. Images fetched transiently at run time; not committed. Preparation only — does NOT enable photo reading.",
  thresholds: "docs/INGESTION_BENCHMARK.md: >=90% legible active recall, >=24/30 exact identity when identifiable, zero invented confident actives.",
  count: items.length,
  items,
};
mkdirSync(join(ROOT, "tests", "fixtures"), { recursive: true });
writeFileSync(join(ROOT, "tests", "fixtures", "ocr-benchmark.json"), JSON.stringify(out, null, 2));
console.error(`\nwrote ${items.length} benchmark fixtures → tests/fixtures/ocr-benchmark.json`);
