#!/usr/bin/env node
// myrota 30-label smoke gate: evaluates human-adjudicated model outputs.
// Does not implement OCR and does not certify medical safety.
import { readFileSync } from "node:fs";

function die(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(2);
}
function normalise(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}
const path = process.argv[2];
if (!path) die("Usage: node scripts/evaluate-label-benchmark.mjs /private/path/labels.json");

let data;
try {
  data = JSON.parse(readFileSync(path, "utf8"));
} catch (error) {
  die(`Could not read JSON: ${error.message}`);
}
const samples = data?.samples;
if (!Array.isArray(samples)) die("Expected an object with a samples array.");

let totalGold = 0;
let foundGold = 0;
let inventedConfident = 0;
let identitiesCorrect = 0;
let overconfidentErrors = 0;
let notRecoverable = 0;
let invalid = 0;
let measured = 0;
let latency = 0;
const latencies = [];
let cost = 0;
let neuronMeasured = 0;
let totalNeurons = 0;
const neuronSamples = [];
const issues = [];
const seenIds = new Set();

for (const s of samples) {
  if (!s || !s.id || seenIds.has(s.id) ||
      !["correct", "incorrect", "unknown"].includes(s.identity_adjudication) ||
      !["verified", "user_review", "partial", "unknown"].includes(s.result_state) ||
      !Array.isArray(s.gold_actives) ||
      !Array.isArray(s.detected_actives) ||
      typeof s.all_material_misses_flagged !== "boolean" ||
      typeof s.review_recoverable !== "boolean") {
    invalid++;
    issues.push(`Invalid or duplicate sample: ${s?.id || "missing id"}`);
    continue;
  }
  seenIds.add(s.id);
  const gold = new Set(s.gold_actives.map(normalise));
  const detected = new Set(s.detected_actives.map(x => normalise(x.inci)));
  if (s.label_legible === true) {
    totalGold += gold.size;
    for (const ingredient of gold) if (detected.has(ingredient)) foundGold++;
  }
  for (const row of s.detected_actives) {
    if (row.confidence === "confident" &&
        (!gold.has(normalise(row.inci)) || row.evidence_on_label !== true)) {
      inventedConfident++;
      issues.push(`${s.id}: unsupported confident ${row.inci}`);
    }
  }
  if (s.identity_adjudication === "correct") identitiesCorrect++;
  if (s.all_material_misses_flagged !== true ||
      (s.identity_adjudication === "incorrect" &&
       ["verified", "user_review"].includes(s.result_state))) {
    overconfidentErrors++;
    issues.push(`${s.id}: wrong or missing data not appropriately flagged`);
  }
  if (["partial", "unknown"].includes(s.result_state) && !s.review_recoverable) {
    notRecoverable++;
    issues.push(`${s.id}: no correction path`);
  }
  if (Number.isFinite(s.workers_ai_neurons) && s.workers_ai_neurons >= 0 &&
      (s.workers_ai_neurons > 0 || s.workers_ai_used === false)) {
    neuronMeasured++;
    totalNeurons += s.workers_ai_neurons;
    neuronSamples.push(s.workers_ai_neurons);
  } else {
    issues.push(`${s.id}: workers_ai_neurons missing or unverified`);
  }
  if (Number.isFinite(s.latency_ms) && Number.isFinite(s.provider_cost_usd)) {
    measured++;
    latency += s.latency_ms;
    latencies.push(s.latency_ms);
    cost += s.provider_cost_usd;
  }
}

latencies.sort((a, b) => a - b);
neuronSamples.sort((a, b) => a - b);
function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}
const count = samples.length;
const recall = totalGold ? foundGold / totalGold : null;
const identityRate = count ? identitiesCorrect / count : 0;
const gate = {
  exactly30DistinctSamples: count === 30 && seenIds.size === 30 && invalid === 0,
  legibleActiveRecall90Pct: recall !== null && recall >= 0.9,
  zeroUnsupportedConfidentActives: inventedConfident === 0,
  correctSku80Pct: count === 30 && identitiesCorrect >= 24,
  zeroUnflaggedOrConfidentlyWrong: overconfidentErrors === 0,
  allPartialUnknownRecoverable: notRecoverable === 0,
  everySampleHasTimeAndCost: measured === 30,
  everySampleHasMeasuredNeurons: neuronMeasured === 30
};
const result = {
  status: Object.values(gate).every(Boolean) ? "PASS" : "NOT_READY",
  sampleCount: count,
  gate,
  metrics: {
    activeRecall: recall,
    activeRecallNumerator: foundGold,
    activeRecallDenominator: totalGold,
    confidentUnsupportedActives: inventedConfident,
    correctIdentities: identitiesCorrect,
    identityAccuracy: identityRate,
    overconfidentErrors,
    notRecoverable,
    invalid,
    measuredCount: measured,
    meanLatencyMs: measured ? Math.round(latency / measured) : null,
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    totalModelCostUsd: measured ? cost : null,
    neuronMeasuredCount: neuronMeasured,
    totalWorkersAiNeurons: neuronMeasured ? totalNeurons : null,
    meanWorkersAiNeuronsPerScan: neuronMeasured ? totalNeurons / neuronMeasured : null,
    medianWorkersAiNeuronsPerScan: percentile(neuronSamples, 0.5),
    p95WorkersAiNeuronsPerScan: percentile(neuronSamples, 0.95),
    estimatedFreeScansPerDay: neuronMeasured === 30 && totalNeurons > 0 ? Math.floor(10000 / (totalNeurons / neuronMeasured)) : null
  },
  issues: issues.slice(0, 100)
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exit(result.status === "PASS" ? 0 : 1);
