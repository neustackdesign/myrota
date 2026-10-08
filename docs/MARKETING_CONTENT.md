# myrota — marketing content and artwork operations

**Decision (8 October 2026): No Sanity dependency in the pilot.** We already have a Next.js/Vercel deployment, typed copy, a photography rights manifest and a branded component system. Adding Sanity now would require another dataset, schema, tokens, Studio, previews and editorial workflow without solving the missing approved illustrations or end-to-end authentication.

## What is editable and where

| Surface | Source of truth | Who changes it |
|---|---|---|
| Homepage headline, pitch, buttons, transparency line | `lib/marketing/content.ts` `landing` | Editor via GitHub web UI / Claude Code |
| SEO metadata | `lib/marketing/content.ts` `seo` | Editor |
| Pre-approved campaign text variants (draft, not auto-published) | `lib/marketing/content.ts` `campaign` | Editor |
| Licensed photography: homepage, invite, milestone, story and OG | `lib/assets/manifest.ts` and `public/photos/` | Designer/developer after licence confirmation |
| RotaSpot creative illustrations and campaign icon placements | `lib/marketing/illustrations.ts` and `public/illustrations/` | Designer/developer after export + usage approval |
| Brand tokens, ring and original icons | Frozen Brand v4 + approved React/SVG components | Designer + implementer, via review |
| Product evidence, skincare advice, ingredient categories and treatment rules | **NOT marketing CMS**: versioned/clinically reviewed server rules | Reviewer + engineering |
| User shelf, routine, completion and friend data | **NOT marketing CMS**: authenticated Cloudflare D1 | App backend |

The photography manifest is already rendered by `components/brand/PhotoSlot.tsx`. Missing or unlicensed images remain visible placeholders on preview. `PROMOTIONAL_ILLUSTRATIONS` is an **inventory**, not yet a runtime uploader; it records where finalized vector masters belong.

## Simple workflow: change copy (no terminal required)

1. In GitHub, open `feat/pilot-vercel-ui` and edit the single field in `lib/marketing/content.ts`.
2. Propose a pull request to the UI branch. Do **not** edit clinical/regulated text, user data, or demo fixtures.
3. Check GitHub CI, Vercel Preview mobile 390px and desktop, and wording against the current product capabilities.
4. Approve and merge when the product release is ready. Vercel builds the latest approved version; there is no runtime content API to break.

## Simple workflow: change an illustration/photo

1. Export the **original approved asset** from Claude Design in the exact named slot (SVG for RotaSpot; optimized WebP/JPG for photographs). Do not copy inspiration assets.
2. Put it into the appropriate `public/` folder via a developer commit. Keep original SVG viewBox and safe colour semantics. Aim to ship responsive sizes when images are large.
3. Record the licensing/use permission and alt text. Production photos need usable web/social rights and model releases; never change the manifest to `licensed` just to hide a placeholder.
4. Update `lib/assets/manifest.ts` or `lib/marketing/illustrations.ts`, replace the placeholder *only when source and approval are available*, and visually inspect mobile and desktop.
5. Merge and publish in the normal Vercel release. Treat social exports as named files/reviewed campaign variants, not an auto-generated promise.

## When to introduce Sanity

Move promotional content (and **only** promotional content) into a dedicated **myrota** dataset when **at least two** of these become true:

- A marketing editor other than the developer must publish without a GitHub pull request.
- Campaign cards, stories, banners or country-specific copy change multiple times per week.
- You need scheduled publishing, campaign expiry, localization or approval roles.
- A reusable bank of licensed assets grows enough that metadata/search are slowing the team.

At that point build only three types: `siteSettings` singleton, `campaign` document with channels/publish windows, and `visualAsset` metadata linked to approved image/file assets. Use Sanity webhooks or Vercel revalidation and cache public content. Keep the UI's frozen tokens and composition in code. Keep all user, ingredient and clinical records in D1 and reviewed rule files, never public CMS.

**Do not migrate to Sanity merely to upload imagery.** For the current pilot, Git + Vercel + the typed registry are fewer moving parts, cheaper and reversible.
