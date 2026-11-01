# myrota — 30 real-label ingestion benchmark, v1

## Purpose
Prove that myrota can turn photos of actual Lagos/Dubai skincare packaging into a user-reviewable structured product without manufacturing confident ingredients. This is the **engineering acceptance gate**, not a medical safety certification.

## Sampling: 30 distinct physical products
- 10 Lagos/Nigeria local products or typical locally distributed products;
- 10 Dubai/GCC shelf products, including mainstream and common imported variants;
- 10 challenging cases: glare/curvature, tiny print, incomplete/foreign-language INCI, poor print, opaque packaging, missing or inconsistent labels.

Capture back/ingredients side by default. Optional front photo when needed to disambiguate product brand/variant. Use consented photos and redact unrelated personal information. Never commit raw user photos or sensitive consumer context to the public repository.

## Gold standard annotation
A human reviewer records, per sample:
- exact brand, product name, variant/size (if legible), format (rinse-off/leave-on);
- verbatim **legible** INCI tokens visible on the label;
- the active INCI tokens/classes relevant to our scoped ontology, with evidence spans;
- parts of the label unreadable, omitted, or not available;
- reference source and manual adjudication notes;
- whether the product has a separately sourced regulatory alert (not inferred from OCR alone).

Compare OCR outputs with the visible label; INCI glossary (e.g. CosIng) is a **name dictionary**, not product truth or evidence of safety.

## Required engine output
Each result has source photo/page reference, OCR/extracted text, product identity fields, INCI tokens, active-class mapping with source spans, format, per-field confidence, and one of:
- verified canonical match
- user-reviewable result (requires confirmation)
- partial
- unknown

Unknown tokens are retained for review, not silently deleted. Do not collapse uncertain product properties into a confident record.

## Acceptance measures
Count against the locked 30 items. Benchmark reports actual numerator/denominator and cannot print PASS unless all 30 have been evaluated.

1. **Active recall on legible labels:** true detected active INCI tokens / gold present active tokens >= 0.90. Compute on legible labelled active regions only; the denominator must be printed.
2. **Confident false positives:** zero invented or unsupported active INCI tokens marked confident after dictionary+source-span validation. A dictionary match without a supporting source span is not evidence.
3. **Identity accuracy:** >= 24/30 exact SKU/product identities correct after optional front-image fallback; record ambiguous variants as unknown, not a wrong confident match.
4. **No overconfident miss:** Every material incorrect/omitted product field or active must be represented as partial/unknown or flagged for user review; **zero** confidently wrong SKU/active results.
5. **Always recoverable:** Every low-confidence result must allow retake/paste/manual correction; no blocked Add flow.
6. **Cost, speed and AI consumption recorded:** model/adapter, median and p95 latency, requests per product, actual estimated cost, and **Workers AI neurons consumed per scan** (including provider fallbacks). Calculate mean, median and p95 neurons/scan, and estimated daily scan capacity at 10,000 free neurons/day. Fail the measurement gate if any of the 30 samples lacks a neuron count for models that consume Workers AI; use 0 only with explicit evidence a scan used no Workers AI.

All gates are per-sample audited; reporting averages may not obscure hazardous error modes. The 30 labels are a product-development gate; expand to 100-product local-coverage test afterward.

## Reviewer distinction
- Formulator: format, formulation claims, ingredient efficacy.
- Pharmacist/dermatologist: high-risk named actives, prescription/pregnancy guidance and warnings.
- Regulatory alert data: independently documented product risk; not equivalent to what a packaging label claims.

## Implementation
- Capture/compress/orient and private upload.
- Run one existing OCR pipeline as baseline (inspect Fleetpass code before assuming provider order and availability).
- Structured interpretation under a strict schema.
- Deterministically normalise tokens against an INCI dictionary; map to active classes using versioned rules, preserving evidence spans.
- User review and correction; personal write-back first; no uncontrolled canonical-cache updates.
- Evaluate provider fallback only on actual failed/partial cases; run comparative 30-photo timing/cost tests.
- Benchmark input will be a non-sensitive local JSON dataset; scripts should compute metrics without publishing photos.

## Input schema for script
Place your annotation results in a private JSON file containing `samples`:
```json
{
  "samples": [
    {
      "id": "NG-01",
      "region": "lagos_local",
      "label_legible": true,
      "gold_actives": ["NIACINAMIDE"],
      "detected_actives": [{"inci": "NIACINAMIDE", "confidence": "confident", "evidence_on_label": true}],
      "identity_adjudication": "correct",
      "result_state": "user_review",
      "all_material_misses_flagged": true,
      "review_recoverable": true,
      "latency_ms": 2000,
      "provider_cost_usd": 0.0001,
      "workers_ai_neurons": 100
    }
  ]
}
```
Store real photos and private labels in an access-controlled location, not here.

To run once the 30 real results exist:
```
node scripts/evaluate-label-benchmark.mjs /secure/path/labels.json
```

## Quota/alert policy
Record daily consumption from Cloudflare Analytics separately from benchmark model estimates. Estimated free-tier scan capacity = floor(10000 / observed mean neurons per scan), with a p95-based conservative estimate alongside it. This estimate ignores other AI traffic sharing the same account, so do not interpret it as a guaranteed allowance. Alert around 60% of daily free capacity; do not silently enter paid usage.
