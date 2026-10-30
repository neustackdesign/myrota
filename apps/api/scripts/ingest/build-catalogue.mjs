#!/usr/bin/env node
/**
 * Build the local, provenance-bearing starter catalogue from Open Beauty Facts.
 *
 * OBF data is Open Database Licence (ODbL): each record keeps its exact source
 * URL + observation date. OBF is crowdsourced → identity/INCI here is
 * `source_listed`, NEVER clinical or pharmacist-reviewed. The server marks every
 * ingredient list `partial` so nothing enters Mix/Rota until a user confirms it.
 *
 * Brands chosen for real availability in Nigeria / UAE / wider GCC
 * (Jumia, Boots ME, Aster, Life Pharmacy, Shoprite, supermarket & pharmacy lines).
 * Active-class tagging is NOT baked here; the server computes it at load with
 * lib/server/inci.ts so detection stays single-sourced.
 *
 *   node scripts/ingest/build-catalogue.mjs            # writes lib/server/catalogue-data.json
 *   node scripts/ingest/build-catalogue.mjs --limit 120
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UA = "myrota-pilot/0.1 (skincare catalogue starter; contact lionproductteam@gmail.com)";
const OBSERVED_AT = process.env.OBSERVED_AT || new Date().toISOString().slice(0, 10);
const TOTAL_LIMIT = Number(process.argv.includes("--limit") ? process.argv[process.argv.indexOf("--limit") + 1] : 800);
const PER_BRAND = Number(process.argv.includes("--per-brand") ? process.argv[process.argv.indexOf("--per-brand") + 1] : 30);
const REQUEST_DELAY_MS = 6500; // OBF search quota: max ~10 requests/min per IP.
const MIN_RECORDS = Number(process.argv.includes("--min") ? process.argv[process.argv.indexOf("--min") + 1] : 196); // never replace seed with a smaller failed crawl

// Availability basis documented in docs/CATALOGUE_PROVENANCE.md.
const BRANDS = [
  "the-ordinary", "cerave", "la-roche-posay", "cetaphil", "neutrogena", "nivea",
  "simple", "garnier", "bioderma", "eucerin", "the-inkey-list", "cosrx",
  "paula-s-choice", "the-body-shop", "nuxe", "avene",
  "minimalist", "beauty-of-joseon", "isntree", "skin1004", "anua", "laneige",
  "cos-de-baha", "good-molecules", "aveeno", "palmers", "vaseline", "dove",
  "olay", "vichy", "uriage", "svr", "hada-labo", "klairs", "purito",
  "pyunkang-yul", "sheamoisture", "clinique", "kiehls", "loreal-paris",
];

// Clean display name per queried brand slug — overrides OBF's noisy `brands` field.
const BRAND_DISPLAY = {
  "the-ordinary": "The Ordinary", "cerave": "CeraVe", "la-roche-posay": "La Roche-Posay",
  "cetaphil": "Cetaphil", "neutrogena": "Neutrogena", "nivea": "Nivea", "simple": "Simple",
  "garnier": "Garnier", "bioderma": "Bioderma", "eucerin": "Eucerin", "the-inkey-list": "The Inkey List",
  "cosrx": "COSRX", "paula-s-choice": "Paula's Choice", "the-body-shop": "The Body Shop",
  "nuxe": "Nuxe", "avene": "Avène",
  "minimalist": "Minimalist", "beauty-of-joseon": "Beauty of Joseon",
  "isntree": "Isntree", "skin1004": "SKIN1004", "anua": "Anua",
  "laneige": "Laneige", "cos-de-baha": "COS DE BAHA", "good-molecules": "Good Molecules",
  "aveeno": "Aveeno", "palmers": "Palmer’s", "vaseline": "Vaseline",
  "dove": "Dove", "olay": "Olay", "vichy": "Vichy", "uriage": "Uriage",
  "svr": "SVR", "hada-labo": "Hada Labo", "klairs": "Klairs",
  "purito": "Purito", "pyunkang-yul": "Pyunkang Yul",
  "sheamoisture": "SheaMoisture", "clinique": "Clinique",
  "kiehls": "Kiehl’s", "loreal-paris": "L’Oréal Paris",
};

const CATEGORY_RULES = [
  [/cleanser|face wash|gel wash|foaming|cleansing|nettoyant|gel nettoyant|lait|micellaire|micellar/i, "cleanser"],
  [/sunscreen|\bspf\b|uv ?[ab]?|sun fluid|sun cream|solaire|solar/i, "sunscreen"],
  [/toner|essence|tonique|lotion tonique/i, "toner"],
  [/serum|sérum|solution|booster|ampoule|concentr/i, "serum"],
  [/moistur|cream|crème|creme|lotion|balm|baume|hydrat|gel-cream|emulsion|émulsion/i, "moisturiser"],
  [/treatment|traitement|retinol|rétinol|retinal|peel|acne|acné|spot|blemish/i, "treatment"],
];
function category(name) {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return "other";
}
// Contract: "Format must be evidenced or explicitly unknown; never default to leave-on."
function format(cat) {
  return cat === "cleanser" ? "rinse_off" : "unknown";
}

function splitInci(text) {
  return text
    .replace(/^\s*ingredients?\s*[:：]\s*/i, "")
    .replace(/\r\n?/g, "\n")
    // OBF entries separate with comma/semicolon/newline, sometimes " / " or ". ".
    .split(/(?<!\d),\s*|,\s*(?!\d)|\s*[;\n·•]\s*|\s+\/\s+|\.\s+(?=[A-ZÀ-Ÿ])/)
    .map((x) => x.trim().replace(/\s+/g, " ").replace(/\.$/, ""))
    .filter((x) => x.length >= 2 && x.length <= 60 && /[a-zA-Z]/.test(x))
    .slice(0, 60);
}

async function fetchBrand(brand) {
  const url = `https://world.openbeautyfacts.org/api/v2/search?brands_tags=${brand}` +
    `&fields=code,product_name,brands,ingredients_text,quantity&page_size=100`;
  let res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429) {
    const delay = Math.max(6500, Math.min(60000, Number(res.headers.get("retry-after") || 12) * 1000));
    console.error(`  429 search throttled; sleeping ${delay / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    res = await fetch(url, { headers: { "User-Agent": UA } });
  }
  if (!res.ok) { console.error(`  ${brand}: HTTP ${res.status}`); return []; }
  const json = await res.json();
  return json.products || [];
}

// Strict GTIN checksum to avoid indexing spurious product identifiers.
function validGtin(code) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === digits.at(-1);
}

const seen = new Set();
const records = [];
let searches = 0;
for (const brand of BRANDS) {
  if (searches++) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  process.stderr.write(`fetching ${brand}… `);
  let products = [];
  try { products = await fetchBrand(brand); } catch (e) { console.error("err", e.message); }
  let kept = 0;
  for (const p of products) {
    const code = String(p.code || "").trim();
    const name = String(p.product_name || "").trim();
    const inci = String(p.ingredients_text || "").trim();
    // Skip incomplete/junk: need a plausible barcode, a real name, and a real INCI list.
    if (!validGtin(code) || name.length < 3 || inci.length < 25) continue;
    if (seen.has(code)) continue;
    const ingredientStrings = splitInci(inci);
    // Quality gate: a usable, well-separated list (drops single-blob/garbled entries).
    if (ingredientStrings.length < 5) continue;
    seen.add(code);
    const cat = category(name + " " + (p.quantity || ""));
    records.push({
      catalogueId: `obf:${code}`,
      barcode: code,
      brand: BRAND_DISPLAY[brand] || (p.brands || "").split(",")[0].trim() || brand.replace(/-/g, " "),
      name: name.slice(0, 120),
      category: cat,
      format: format(cat),
      variant: (p.quantity || "").trim().slice(0, 40) || null,
      ingredientStrings,
      provenance: {
        source: "openbeautyfacts",
        sourceUrl: `https://world.openbeautyfacts.org/product/${code}`,
        observedAt: OBSERVED_AT,
        level: "source_listed",
        license: "ODbL-1.0",
      },
    });
    kept++;
    if (kept >= PER_BRAND || records.length >= TOTAL_LIMIT) break;
  }
  console.error(`kept ${kept} (total ${records.length})`);
  if (records.length >= TOTAL_LIMIT) break;
}

records.sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name));
const out = {
  generatedAt: OBSERVED_AT,
  source: "Open Beauty Facts (ODbL-1.0)",
  note: "Crowdsourced discovery data. source_listed only — never clinical verification. Server marks INCI partial.",
  count: records.length,
  products: records,
};
if (records.length < MIN_RECORDS) throw new Error(`Refusing to overwrite current catalogue with only ${records.length} records (minimum ${MIN_RECORDS}). Check OBF throttling and brand coverage.`);
const dest = join(ROOT, "lib", "server", "catalogue-data.json");
writeFileSync(dest, JSON.stringify(out, null, 2));
console.error(`\nwrote ${records.length} products → ${dest}`);
