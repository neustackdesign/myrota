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
    `&fields=code,product_name,brands&page_size=60`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  return r.ok ? (await r.json()).products || [] : [];
}

// Benchmark must be LANGUAGE-MATCHED: use the ENGLISH ingredient photo together
// with the ENGLISH declared text, so recall measures OCR — not a translation gap.
// Returns { image, text } only when an English ingredient panel + English INCI exist.
async function englishLabel(code) {
  const r = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${code}?fields=selected_images,ingredients_text_en`, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const p = (await r.json())?.product || {};
  const image = p.selected_images?.ingredients?.display?.en || null;
  const text = (p.ingredients_text_en || "").trim();
  return image && text.length >= 25 ? { image, text } : null;
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
    if (!/^\d{8,14}$/.test(code) || name.length < 3 || seen.has(code)) continue;
    seen.add(code);
    // Require a language-matched ENGLISH ingredient photo + English declared text.
    const en = await englishLabel(code);
    if (!en) continue;
    const img = en.image;
    const groundTruth = en.text.replace(/^\s*ingredients?\s*[:：]\s*/i, "").split(/[,;\n·•]+/).map((x) => x.trim()).filter((x) => x.length >= 2);
    if (groundTruth.length < 5) continue;
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
