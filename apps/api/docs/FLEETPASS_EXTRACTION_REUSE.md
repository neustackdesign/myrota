# Fleetpass extraction: verified reuse notes — 8 Oct 2026

Reviewed repository `neustackdesign/fleetpass`, default branch, source files:

- `src/lib/extraction/pipeline.ts`
- `src/lib/extraction/cloudflare.ts`
- `src/lib/extraction/groq.ts` (adapter exists; inspect current source before porting)
- `src/lib/extraction/tesseract.ts`
- `src/lib/extraction/budget.ts`
- `src/lib/extraction/types.ts`
- `src/lib/extraction/pipeline.test.ts`

## Verified behaviour
1. Cloudflare `/ai/tomarkdown` extracts text from uploaded document/image bytes using multipart POST; `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` configuration is checked.
2. Groq structures extracted text into *Fleetpass-specific* fields; myrota must introduce a different strict output schema (INCI spans, product identity, format, uncertainty).
3. The pipeline has one total time budget and bounded per-stage deadlines; partial results and failure categories survive, including actual provider, timing and raw-text provenance.
4. PDF text-layer extraction is handled in the browser in the current Fleetpass architecture, not an assumed deployed native PDF parser.
5. **Tesseract raster fallback is deliberately OFF by default.** The source documents a production deployment where it exhausted a 15s slice, returned nothing and contributed to 40s empty results. Do not re-enable blindly.

## What to reuse
- Cloudflare adapter API shape and credential boundary;
- time-budget pattern and provider attribution;
- partial/failed outcome semantics;
- bounded-text transport and field validation discipline;
- existing unit-test style.

## What must change for myrota
- Current four Fleetpass fields are not skincare knowledge. Replace structuring with brand, exact product name/variant, product format, verbatim INCI segments, normalised tokens and per-field evidence spans.
- A model's structured output is *candidate extraction only*. INCI dictionary/mapping and reviewed safety/routine rules determine what can be treated as known.
- Dense curved cosmetics labels, glare and bilingual text need a **fresh 30-label benchmark** before a preferred provider order or cost expectation is locked.
- Do not transplant Fleetpass's exact timeout allocation, label semantics or fallback policy without measurements.
- No provider credentials, images or user context belong in this public repo.

See `docs/INGESTION_BENCHMARK.md` and `scripts/evaluate-label-benchmark.mjs`.
