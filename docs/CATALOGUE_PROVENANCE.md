# Starter catalogue provenance

**Source:** [Open Beauty Facts](https://world.openbeautyfacts.org) (`ingredients_text`, `code`/barcode, `brands`).
**Licence:** Open Database Licence (ODbL-1.0). Each baked record stores its exact product URL + observation date.
**Status:** `source_listed` — crowdsourced discovery data. **NOT clinical verification, NOT pharmacist-reviewed.**

## What this is and is not
- OBF membership tells us a product *exists* and gives a *declared* INCI list.
- It does **not** verify the ingredients are current/complete, nor make any safety/compatibility claim.
- Therefore every catalogue result is served with `inciStatus: "partial"`. It only becomes analysable (enters Mix/Rota) after the **user confirms** the list on the Review screen (→ `user_confirmed`). A catalogue listing alone never contributes an active to a verdict.

## Provenance levels (server-side, per record)
`source_listed` → `user_confirmed` → `pharmacist_reviewed`. Only the first exists today.

## Brands (real availability basis: NG / UAE / GCC)
The Ordinary, CeraVe, La Roche-Posay, Cetaphil, Neutrogena, Nivea, Garnier, Bioderma, Eucerin, Avène, Nuxe, Simple, The Body Shop, COSRX, Paula's Choice, The Inkey List — all stocked via Jumia (NG), Boots ME, Aster, Life Pharmacy, Shoprite and supermarket/pharmacy lines in the UAE/GCC. Availability is the selection basis; OBF country tags are too sparse to filter on.

## Rebuild
```
npm run catalogue:build        # queries OBF, normalises, writes lib/server/catalogue-data.json
```
Quality gates in the ingester: real barcode (8–14 digits), real product name, ≥5 cleanly-separated ingredient strings, dedup by barcode, canonical brand display, per-brand cap. Active-class tagging is **not** baked — the server computes it at load via `lib/server/inci.ts` so detection stays single-sourced.

## Current size
~196 products across 16 brands (2026-10-09 observation).

## Known limitations
- Some OBF entries are non-English (French/Portuguese listings) or have imperfect separators — acceptable because the user confirms/corrects on Review before anything is used.
- No barcode-scan verification yet; identity on Shelf-add from catalogue is at most `user_confirmed`, never `verified`.
