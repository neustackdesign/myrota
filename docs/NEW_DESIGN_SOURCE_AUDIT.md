# New design source audit — Landing (1) + Prototype v1.6

Audited 9 Oct 2026 from the files attached to this session's overnight brief:

- `myrota Landing (1).html`: document title "myrota — Your shelf, in the right order.", 114,224-character template.
- `myrota Prototype (1).html`: "MVP prototype v1.6 · Design Fixes v1.5", 225,613-character template.

Neither source file is committed: both embed font binaries, which must not be redistributed.

## Method

Both files are Claude Design packed bundles. Each contains four script blocks:

- `__bundler/manifest`: uuid → base64/gzip asset.
- `__bundler/template`: JSON-encoded HTML.
- `__bundler/ext_resources`: component id → uuid.
- `__bundler/page_order`.

`scripts/design-import/unpack.py` decodes them. Components are `.dc.html` files: `<x-dc>` markup with `{{ }}` bindings, `<sc-if>`, `<sc-for>` and `<dc-import>`, plus a `DCLogic` class whose `renderVals()` computes the bindings. `dc2tsx.py` converts that markup to TSX mechanically:

- Style strings become objects; CSS duplicates resolve last-wins, as in the browser.
- `style-hover`, `style-active` and `style-focus` become generated classes in `app/dc-states.css`.
- Font families map to `next/font` CSS variables.
- Lower-cased SVG tags and attributes are restored.

The logic was ported by hand: Landing → `components/landing/useLandingVM.tsx`; Prototype → `lib/app/useAppVM.tsx` (production) and a verbatim demo copy at `lib/demo/prototype-logic.js`. Parity was checked by screenshotting the original HTML and the port side by side. The landing hero, TU, WE and FR chapters, and the Today state, match to within ~1px.

## Shared components (byte-identical in both files)

| Component | Props | Notes / ported to |
|---|---|---|
| Wordmark | size, font (Faculty Glyphic · Geist · Archivo · Hanken Grotesk), weight, ink, accent, tones | "myr" + 7-segment ring "o" + "ta"; geometry formula preserved → `components/brand/Wordmark.tsx` |
| RotaRing | size, filled, sw, gap, track, tones (`x` = missed hairline), lit, hollow, missed (notch), rescued (Sea glass + inner Tide) | v6.1 states, 520ms fill transition → `RotaRing.tsx` |
| RotaMarker | 20 icons; mono/colour; wobble turbulence | → `RotaMarker.tsx` (generated paths) |
| Grain | 18 presets (cover, lagoon, dusk, tide, rinse, sunrise, evening, streak, sun, skin, sea, dots, mono, dune, swirl, fold, halo, petal) | SVG generator → `lib/brand/grain.ts` + `Grain.tsx` |
| PhotoFrame | slot, shot, field, bg, ratio, rule (7-bar), radius, pad, caption | → `PhotoFrame.tsx` |
| MomentCard | who, what, meta, mini ring | → `MomentCard.tsx` |
| DayTag | Retinoid · Exfoliant · Recovery · Rest · Morning · Evening · Rescued · SPF · Unknown; pill/inline | + `Daily` (production) → `DayTag.tsx` |
| RhythmStrip | days, today, selected, scale, words, legend, detail | + `Daily` type → `RhythmStrip.tsx` |
| Avatar (prototype only) | built look (skin 0–8, 12 hair, 4 faces, 7 extras, 6 backgrounds), monogram, doodle, ring | → `Avatar.tsx` |
| RotaSpot (prototype only) | scenes: shelf, morning, evening, friends | → `RotaSpot.tsx` |

## Tokens (as used in the sources)

| Name | Hex | Name | Hex |
|---|---|---|---|
| Ink | `#2A1911` | Paper | `#FBFAF6` |
| Shell / peach | `#F1E0D2` | Sand (page) | `#F7EFE7` |
| Coral (primary CTA) | `#EE6F3E` | Deep teal / evening | `#1E3A3C` |
| Sea glass | `#9ED8CF` | Tide / aqua | `#1F7F7E` |
| Contextual blue | `#3E63D8` | Sienna (unknown) | `#845535` |
| Umber (secondary text) | `#5A3824` | Link | `#A9401A` |
| Dew | `#E3F1EC` | Apricot | `#F6B48F` |
| Ring track | `#EADCCF` / `#E8D8C9` | Done tones | `#845535 #2A1911 #A8764F #5A3824` |

Typography: Faculty Glyphic 400 (display), Geist 300–800 (UI), Geist Mono 400/500 (kickers, `.08em` tracking, uppercase).

CTA: coral fill, `2px solid #2A1911`, `999px` radius, `box-shadow: 3px 4px 0 #2A1911`; hover shifts 1px; active `translate(2px,3px)` with a 1px shadow.

Motion keyframes: `lp-marquee`, `lp-fill`, `lp-rise`, `lp-roll`, `lp-drift`, `lp-scale`, `rv-drop`. All are disabled under `prefers-reduced-motion`.

## Landing (1): seven chapters

| Ch | Label | Headline | Interaction | Data |
|---|---|---|---|---|
| MO 01 | Hero + "Say the day" band | "Your shelf, in order." | hero ring fills 0→4 at 80ms; drifting evening grain with parallax and blur; marquee pauses on hover | slot `lp4-shot1`, `lp4-shot6` |
| TU 02 | Add anything | "Add what you own. Even the one with no label." | chips launch along SVG offset-paths at 650ms; four nodes open fragments (scan/search/paste/gallery) | `lp4-shot3` |
| WE 03 | The week | "See the whole week before you start." | 360vh pinned story, 4 steps (Plan · Do · Rest · Rescue), phone mock, expandable week dialog | — |
| TH 04 | A day | "Five minutes of your day. The rest stays yours." | 5 auto-advancing slots (4s), pause/play, palette shift to dark (`data-tone="dyn"`) | `lp4-shot5`, `lp4-shot7` |
| FR 05 | Mix Check | "Can these two share a night?" | pick 2 of 8 products → illustrative verdict; preset pairs; share; build | — |
| SA 06 | Friends | "Friends see your ring. Never your shelf." | 4-item ticker every 2.4s; WhatsApp CTA | `lp4-shot4`, `lp4-shot9`, `lp4-shot10` |
| SU 07 | Questions + final CTA + footer | "Before you start." / "Start tonight." | FAQ accordion (6), final CTA, footer wordmark fill, mobile CTA dock | `lp4-shot2` |

Nav: fixed bar, seven chapter bars with tooltips, dark/light tone from the section under the bar, "Check two products" → FR, "Build my rota" → app.

## Prototype v1.6: screens and sheets

**Screens (20):** welcome, add, scan, review, context, building, reveal, today, dayDone, shelf, friends, whatsapp, inviteLanding, friendJoined, mix, mixResult, rotaComplete, nextWeek, reminders, lock.

**Sheets (18):** unknown, invite, rescue, install, claim, profile, avatar, share, nudge, name, notes, week, day, product, swap, paste, chip, mixPick.

The review chrome (journey list, step list, simulate controls, logic/budget/live-data panels, phone frame, fake status and URL bars, fake OS permission dialog) is design-review tooling and is not shipped. The full state manifest and its production mapping are in `docs/PROTOTYPE_TO_PRODUCTION_MATRIX.md`.

## Image-slot register

| Slot | File | Brief (from source) | Production asset (see `lib/assets/slots.ts`) |
|---|---|---|---|
| lp4-shot1 | Landing hero | Woman, darker skin, mid-step at a mirror, cleanser in hand · evening lamp | Pexels 7269486 (pending visual sign-off) |
| lp4-shot2 | Landing final CTA | Hands with serum dropper above a sink, morning window | Pexels 5938589 (pending) |
| lp4-shot3 | TU | Bathroom shelf, anonymous bottles, one unlabelled jar | none → designed Grain |
| lp4-shot4 | SA | Two friends at one mirror, laughing | Pexels 6579978 (pending) |
| lp4-shot5 / 7 | TH | Morning / evening routine moments | none → Grain |
| lp4-shot6 | MO band | Close crop cheek texture, moisturiser pressed in, evening lamp | Pexels 5938600 (pending) |
| lp4-shot9 | SA | Lagos bathroom detail | none → Grain |
| lp4-shot10 | SA | Older woman, darker skin, evening routine | Pexels 7269467 (pending) |
| photo-welcome | PWA welcome | as lp4-shot1 | Pexels 7269486 (pending) |
| photo-rota-complete | Rota complete | milestone portrait, warm daylight | Pexels 5938600 (pending) |
| photo-invite | Invite landing | two friends, candid | Pexels 6579978 (pending; screen is demo-only) |
| share-ring-window | Day-7 share card | circular photo behind the ring | Pexels 7269467 (pending) |
| share-day3 / share-friend | share cards | SPF on cheek / two friends | none / 6579978 |

All Pexels assets are still served from the Pexels CDN and have not been self-hosted: `pexels.com` is egress-blocked from the build sandbox, so neither download nor visual review was possible. When a file is missing or blocked, the slot shows its designed Grain field, never a broken image.

## Copy and CTA paths

- Every landing Build/Start/Open CTA links to `/app?src=landing` (or `src=landing-mix` from FR, carrying the pair as names). Analytics `cta_start` records where it was tapped.
- Prototype journeys start at `/app`. A returning user with a rota opens Today; one with a shelf but no rota opens Build.
- Truthfulness edits are listed in `docs/DESIGN_DIFF_AND_CONTRACT.md`.
