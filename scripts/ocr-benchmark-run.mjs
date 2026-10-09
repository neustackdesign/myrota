#!/usr/bin/env node
/**
 * Run the photo-OCR benchmark against a deployed Worker's /api/extract.
 *
 * PREREQUISITE: photoReading must be enabled on the target (AI binding +
 * PHOTO_READING_ENABLED=1). This harness measures quality; it does NOT enable
 * anything. Report thresholds: docs/INGESTION_BENCHMARK.md.
 *
 *   node scripts/ocr-benchmark-run.mjs https://myrota-staging.neustackdesign.workers.dev
 *
 * Images are fetched transiently from OBF and never stored. Scores legible
 * ingredient/active recall against the declared ground truth and flags any
 * confidently INVENTED active (present in extract, absent from the label text).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!BASE) { console.error("usage: ocr-benchmark-run.mjs <worker-base-url>"); process.exit(2); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
const fixtures = JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "ocr-benchmark.json"), "utf8")).items.slice(0, LIMIT)
  // use a medium OBF render for latency; full-res is too slow on small vision models
  .map((f) => ({ ...f, imageUrl: f.imageUrl.replace(/\.full\.jpg$/i, ".600.jpg") }));

const norm = (s) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\b\d+(\.\d+)?\s*%/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ACTIVES = [/\bretin(ol|al|aldehyde|oin)\b/, /ascorbic acid|ascorbyl|ascorbate/, /niacinamide/, /salicylic acid/, /glycolic acid|lactic acid|mandelic acid/, /azelaic acid/, /benzoyl peroxide/];
const activesIn = (texts) => new Set(ACTIVES.filter((re) => texts.some((t) => re.test(t))).map((re) => re.source));

const lat = [];
let totRecall = 0, totActiveRecall = 0, invented = 0, legible = 0, failures = 0, done = 0;
for (const f of fixtures) {
  let buf;
  try { const r = await fetch(f.imageUrl); if (!r.ok) throw 0; buf = Buffer.from(await r.arrayBuffer()); } catch { console.log(`skip ${f.barcode}: image fetch failed`); continue; }
  const fd = new FormData();
  fd.set("image", new Blob([buf], { type: "image/jpeg" }), "label.jpg");
  fd.set("method", "scan"); fd.set("side", "back");
  const t0 = Date.now();
  let res, j;
  try { res = await fetch(`${BASE}/api/extract`, { method: "POST", body: fd }); j = await res.json(); } catch { failures++; continue; }
  const ms = Date.now() - t0; lat.push(ms); done++;
  if (!j?.ok) { console.log(`${f.barcode} ${f.name.slice(0, 28)} → problem:${j?.problem} (${ms}ms)`); failures++; continue; }
  legible++;
  const extracted = j.candidate.ingredients.map((i) => norm(i.text)).filter(Boolean);
  const gt = f.groundTruthInci.map(norm).filter(Boolean);
  const matched = gt.filter((g) => extracted.some((e) => e === g || e.includes(g) || g.includes(e))).length;
  const recall = gt.length ? matched / gt.length : 0;
  totRecall += recall;
  const gtActives = activesIn(gt), exActives = activesIn(extracted);
  const aMatched = [...gtActives].filter((a) => exActives.has(a)).length;
  totActiveRecall += gtActives.size ? aMatched / gtActives.size : 1;
  // Invented confident active: in extract, not on the label's declared text.
  const inv = [...exActives].filter((a) => !gtActives.has(a)).length;
  invented += inv;
  console.log(`${f.barcode} ${f.name.slice(0, 28).padEnd(28)} recall=${(recall * 100).toFixed(0)}% active=${aMatched}/${gtActives.size} invented=${inv} ${ms}ms`);
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0; };
console.log(`\n==== OCR benchmark (${done}/${fixtures.length} run) ====`);
console.log(`legible/ok:        ${legible}/${fixtures.length}`);
console.log(`mean INCI recall:  ${(100 * totRecall / Math.max(1, legible)).toFixed(1)}%  (gate >=90% legible active recall)`);
console.log(`mean active recall:${(100 * totActiveRecall / Math.max(1, legible)).toFixed(1)}%`);
console.log(`INVENTED actives:  ${invented}  (gate: 0 confidently invented)`);
console.log(`failures/problems: ${failures}`);
console.log(`latency median/p95:${med(lat)}ms / ${p95(lat)}ms`);
console.log(`PASS? ${legible / fixtures.length >= 0.9 && invented === 0 ? "candidate — review full criteria in docs/INGESTION_BENCHMARK.md" : "NO"}`);
