# myrota — asset manifest (UI v1.2 branch)

Status 8 Oct 2026. Source of truth for production imagery, brand vectors and copy that still needs rights or review. Mirrors `lib/assets/manifest.ts`. **No unlicensed or competitor imagery is used anywhere.** A photo slot renders its image only when its entry is marked `licensed` with a `src`; otherwise the UI shows an explicit, plated "Missing licensed asset" state.

## 1. Photography — production dependency (all MISSING)

Brief for every photo (Component System v1.2): prominently African and darker-skin people, real texture, natural or warm daylight, no retouching that removes pores or tone variation. Minimum 2400px long edge, sRGB. Faces clear of the bottom 20%, where plates sit. Rights: commissioned or licensed for **web, social and paid use**, with **signed model releases**. Record the licence and expiry for each asset.

| ID | Expected file (`public/photos/`) | Used on | Aspect / crop | Rights | Status |
|---|---|---|---|---|---|
| PH-01 | `landing-hero-4x5.jpg` | Landing `/` | 4:5 portrait; face in upper 60% | needs licence + model release | **Missing** |
| PH-02 | `invite-friends-4x5.jpg` | Invite landing `/i/[token]` | 4:5; two faces upper 60%; inviter chip top-left | needs licence + 2 releases | **Missing** |
| PH-03 | `rota-complete-4x5.jpg` | Rota complete `/week/complete` | 4:5; subject left of centre; ring disc overlaps bottom-right | needs licence + release | **Missing** |
| PH-04 | `share-story-9x16.jpg` | Optional 9:16 share background | 9:16; faces clear of bottom 20% | social + paid use | **Missing** (cards currently use brand fields only) |
| PH-05 | `og-1200x630.jpg` | OG / link preview | 1.91:1; subject right third | social use | **Missing** |

To activate: add the file, then set `rights: "licensed"`, `src`, `licence` and `expires` in `lib/assets/manifest.ts`.

## 2. Brand vectors — PROVISIONAL re-draws

The supplied Brand v4, Prototype v1.2 and Component System files import these as `<dc-import>` components, but their source was **not** included. They were rebuilt from the documented specs and must be replaced with the frozen masters.

| ID | Component | File | What was rebuilt | Replace with |
|---|---|---|---|---|
| BR-01 | Wordmark (Faculty Glyphic + ring "o") | `components/brand/Wordmark.tsx` | Typeset "myr" + seven-segment ring o (gap at twelve, one accent segment) + "ta" | Frozen Brand v4 wordmark SVG (all colourways) |
| BR-02 | Rota Ring | `components/brand/RotaRing.tsx` | 7 segments, gap at 12, non-monotonic done tones, Sea glass recovery/rescued, Sienna hairline missed, track future. Tokens exact | Keep the geometry; confirm the gap angle and stroke ratio against the master |
| BR-03 | RotaMarker icons (20) | `components/brand/RotaMarker.tsx` | Geometric stand-ins: 48 grid, 3 stroke, solid offset shadow, one flat fill | Hand-drawn marker SVGs from Brand v4 §7.2 (same names) |
| BR-04 | Grain fields (sunrise, dusk, evening, skin, sea, tide, rinse, streak, lagoon) | `app/globals.css` `.grain--*` + `public/brand/skin-grain.svg` | Noise uses the exact Brand v4 `skin()` filter recipe (k = 0.18); colour masses approximated with radial gradients | Brand v4 `<Grain>` preset source |
| BR-05 | RotaSpot illustrations (shelf, morning, evening, friends) | not built | Friends and the empty Shelf use a large marker icon on grain as a placeholder | Brand v4 RotaSpot SVGs |
| BR-06 | App icons | `public/icons/*` | Unchanged from main (pre-v4) | Ring app icon (Shell / Sea glass / Ebony) from Brand v4 §8 |

Fonts: Faculty Glyphic, Geist and Geist Mono are self-hosted at build time via `next/font/google` (all SIL OFL).

## 3. Copy needing pharmacist / legal review before launch

None of this is reviewed. In production it renders only when a rule has status `reviewed` with attributed reviewers.

| Where | Copy | Owner |
|---|---|---|
| `lib/demo/fixtures.ts` `DEMO_LABEL_FLAG` | Hydroquinone label-declared note (HQ-01) | Pharmacist |
| `lib/demo/fixtures.ts` `DEMO_ALERT_FLAG` | Regulator-alert note; regulator/reference/URL are placeholders | Legal + content |
| `lib/demo/fixtures.ts` `DEMO_RULES` | All pair, timing and context-hold rules ("Placeholder copy pending review") | Pharmacist / dermatologist |
| `lib/domain/week.ts` `REFLECTION_NOTE` | "If irritation continues, talk to a pharmacist…" | Pharmacist |
| `lib/domain/mix.ts` `VERDICT_LINE` and safety-flag reasons | Generic verdict sentences | Content + pharmacist |
| Context questions (`app/build/context`) | Pregnancy / prescription wording | Pharmacist + privacy |

## 4. Third-party marks

The WhatsApp share uses the plain text label "WhatsApp" and `wa.me` links only; no WhatsApp logo is embedded. The Google sign-in button is text-only; before launch, use Google's branded button assets per their guidelines.
