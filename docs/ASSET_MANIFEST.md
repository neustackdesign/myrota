# myrota — asset manifest (UI v1.2 branch)

Status 8 Oct 2026. Source of truth for production imagery, brand vectors and copy that still needs rights or review. Mirrors `lib/assets/manifest.ts`. **No unlicensed or competitor imagery is used anywhere.** A photo slot renders its image only when its entry is marked `licensed` with a `src`; otherwise the UI shows an explicit, plated "Missing licensed asset" state.

## 1. Photography — sourced pilot imagery (9 Oct 2026)

Production pilot uses Pexels-hosted photographs with creator and source URLs recorded in `lib/assets/manifest.ts`. These are provisional art-direction selections, not commissioned photography. Pexels permits free commercial use; do not imply the subjects endorse myrota. CDN accessibility, final crop and colour grading must be tested in Vercel Preview. Avoid unverified claims of individual signed model releases.

| ID | Placement | Pexels photograph | Creator |
|---|---|---|---|
| PH-01 | Landing hero | https://www.pexels.com/photo/7269486/ | Anete Lusina |
| PH-02 | Friends invite | https://www.pexels.com/photo/6579978/ | Alex Starnes |
| PH-03 | Week-complete milestone | https://www.pexels.com/photo/5938600/ | Sora Shimazaki |
| PH-04 | Story background | https://www.pexels.com/photo/7269467/ | Anete Lusina |
| PH-05 | OG candidate | https://www.pexels.com/photo/5938589/ | Sora Shimazaki |

**Caveat:** PH-05 is now wired into Open Graph and Twitter metadata in `app/layout.tsx`, but the final branded horizontal crop must be visually tested; PH-04 remains an optional share-card background, not automatically exported. Hosted images should be downloaded, optimised and self-hosted in a later asset packaging pass to avoid third-party CDN runtime dependence. Retna candidate: Salem Ochidi's dark-skin beauty portrait (https://retna.io/photos/a-nerdy-beauty-portrait-of-a-dark-skinned-model-with-beautiful-bokeh-QOPlNf); direct asset download has not been confirmed, so do not mark it as shipped.

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
| `lib/demo/prototype-logic.js` `FLAGS` (demo gallery only) | Hydroquinone label note and regulator-alert note with `[pharmacist]`/`[regulator]` placeholders | Pharmacist, legal + content |
| `components/landing/useLandingVM.tsx` Mix verdicts (labelled illustrative) | Landing FR example verdicts | Pharmacist |
| `lib/domain/week.ts` `REFLECTION_NOTE` | "If irritation continues, talk to a pharmacist…" | Pharmacist |
| `lib/domain/mix.ts` `VERDICT_LINE` and safety-flag reasons | Generic verdict sentences | Content + pharmacist |
| Context questions (`lib/app/useAppVM.tsx` `ctxQs`) | Pregnancy / prescription wording | Pharmacist + privacy |
| `app/legal/[slug]/page.tsx` | Pilot privacy / terms / not-medical-advice drafts | Legal |

## 4. Third-party marks

The WhatsApp share uses the plain text label "WhatsApp" and `wa.me` links only; no WhatsApp logo is embedded. The Google sign-in button is text-only; before launch, use Google's branded button assets per their guidelines.

## 5. v1.6 design image slots (overnight integration)

Slot → asset mapping lives in `lib/assets/slots.ts`; the slot briefs are in `docs/NEW_DESIGN_SOURCE_AUDIT.md` (image-slot register).

| Slot | Asset key | Pexels ID / creator | Focal point | Review |
|---|---|---|---|---|
| lp4-shot1, photo-welcome | landingHero | 7269486 · Anete Lusina | 50% 30% | pending visual + crop sign-off |
| lp4-shot2 | ogImage | 5938589 · Sora Shimazaki | 60% 45% | pending (brief asks for hands + dropper; may not match) |
| lp4-shot4, photo-invite, share-friend | inviteHero | 6579978 · Alex Starnes | 50% 35% | pending |
| lp4-shot6, photo-rota-complete | milestone | 5938600 · Sora Shimazaki | 45% 40% / 40% 35% | pending |
| lp4-shot10, share-ring-window | shareStory | 7269467 · Anete Lusina | 50% 35–40% | pending |
| lp4-shot3, 5, 7, 9, share-day3 | — | none | — | designed Grain field shown |

All five files are still CDN-hosted (`images.pexels.com`) and have no recorded hash. The overnight sandbox could not reach Pexels to download, inspect or self-host them. On any load failure the slot renders nothing over its Grain field (no broken image). The OG/Twitter image is now the generated typographic card `app/opengraph-image.tsx`.
