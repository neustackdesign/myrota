import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function makeSamples() {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `S-${String(i + 1).padStart(2, "0")}`,
    region: i < 10 ? "lagos_local" : i < 20 ? "gcc_import" : "difficult",
    label_legible: true,
    gold_actives: ["NIACINAMIDE"],
    detected_actives: [{ inci: "NIACINAMIDE", confidence: "confident", evidence_on_label: true }],
    identity_adjudication: "correct",
    result_state: "user_review",
    all_material_misses_flagged: true,
    review_recoverable: true,
    latency_ms: 1200,
    provider_cost_usd: 0.001,
    workers_ai_used: true,
    workers_ai_neurons: 50
  }));
}
function evaluate(samples) {
  const folder = mkdtempSync(join(tmpdir(), "myrota-ocr-gate-"));
  const file = join(folder, "gold.json");
  try {
    writeFileSync(file, JSON.stringify({ samples }));
    const result = spawnSync(process.execPath, ["scripts/evaluate-label-benchmark.mjs", file], {
      encoding: "utf8"
    });
    if (result.error) throw result.error;
    return { status: result.status, output: JSON.parse(result.stdout) };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test("30 synthetic adjudicated samples prove evaluator PASS behaviour only", () => {
  const result = evaluate(makeSamples());
  assert.equal(result.status, 0);
  assert.equal(result.output.status, "PASS");
  assert.equal(result.output.metrics.activeRecallDenominator, 30);
});

test("a confident ingredient absent from source fails", () => {
  const samples = makeSamples();
  samples[0].detected_actives.push({ inci: "RETINOL", confidence: "confident", evidence_on_label: false });
  const result = evaluate(samples);
  assert.equal(result.status, 1);
  assert.equal(result.output.metrics.confidentUnsupportedActives, 1);
});

test("incomplete real sample count never passes", () => {
  const result = evaluate(makeSamples().slice(0, 29));
  assert.equal(result.status, 1);
  assert.equal(result.output.gate.exactly30DistinctSamples, false);
});

test("recall below 90 percent fails", () => {
  const samples = makeSamples();
  for (let i = 0; i < 4; i++) {
    samples[i].detected_actives = [];
    samples[i].result_state = "partial";
  }
  const result = evaluate(samples);
  assert.equal(result.status, 1);
  assert.equal(result.output.gate.legibleActiveRecall90Pct, false);
});

test("missing Workers AI neuron measurement fails gate even if extraction is correct", () => {
  const samples = makeSamples();
  delete samples[0].workers_ai_neurons;
  const result = evaluate(samples);
  assert.equal(result.status, 1);
  assert.equal(result.output.gate.everySampleHasMeasuredNeurons, false);
});

test("benchmark computes total neurons and daily estimate without pretending these are real scans", () => {
  const result = evaluate(makeSamples());
  assert.equal(result.output.metrics.totalWorkersAiNeurons, 1500);
  assert.equal(result.output.metrics.estimatedFreeScansPerDay, 200);
});
