# myrota — first 10-user pilot

**Date set:** Friday, **16 October 2026**, private PWA pilot target (not a promised public launch). This is a delivery target; it does **not** waive ingestion and safety quality gates.

## Oct 8–9: Intelligence track A
- Assemble 30 consented, anonymised product-label samples (back + optional front) across Lagos local, GCC/imported, and deliberately difficult labels.
- Annotate identity/variant, verbatim legible INCI, identified actives, product format, known label/regulatory alerts, and readability.
- Inventory reusability of Fleetpass/ApplyOS OCR model adapters, benchmark provider cost/latency before selecting route.
- Build capture, OCR/extraction, dictionary-normalisation, field-by-field evidence and review interfaces against samples.
- Have appropriate reviewer sign off any safety warning or routine rule **before** exposing it as user guidance.
- Reference: docs/INGESTION_BENCHMARK.md

## Oct 8–12: Product/design
- Claude Design produces only the v1.2 corrections from docs/CLAUDE_DESIGN_V1_2.md.
- Engineering implements the ingestion and state contracts while UI is being resolved.
- Do not await artwork to build the backend. Brand typography, tokens, icons and final imagery are applied when assets arrive.

## Oct 12–14: Core loop integration
- Scan/search/paste/gallery → review → persistent shelf.
- Contextual questions → reviewed seven-day rota → AM/PM/Rest completion → rollover and Rescue.
- Supabase anonymous identity + row-level security; Google/Apple/email-code claim when configured.
- Real reusable invite token, pair acceptance and joint streak.
- WhatsApp-first share, Mix verdict, explicit unknown fallback.
- Android/iOS PWA onboarding.

## Oct 15: Release candidate
- Production build and CI green.
- 30-label extraction gate passed using **real** samples and rubric.
- No draft medical/safety rule presented as signed-off.
- Cross-browser smoke test, especially iOS Safari → Home Screen → Safari refresh/reopen.
- Real invite activation tested on independent devices and across Dubai/Lagos timezone boundary.
- Retake/review paths handle extraction failure without trapping the user.

## Oct 16: Private pilot (10 people)
- Invite via private URL, not public announcement.
- 5 Lagos + 5 Dubai participants if recruited; ensure product diversity.
- Observe first-time product add, rota reveal, completion, install/claim, invitation and invitee activation.
- Collect real errors and qualitative pain points; do not interpret 10 users as a statistically conclusive retention experiment.
- Measure: extraction success, share/invite attempts, invited-user activation, D1 completion; track D7 after pilot.

## Exit criteria
Minimum:
1. One real product not in seed catalogue can be photographed or pasted, structured, reviewed and added without inventing a confident active.
2. A user creates an explainable, reviewed rota without stacking unresolved products as if known.
3. AM/PM/Rest check-offs and streak/Rescue persist and survive session refresh.
4. WhatsApp invite opens another person's own onboarding, leads to account pairing and counts joint completion correctly.
5. Interface matches approved Brand v4 + v1.2 product system.
6. Responsive production build; no blockers in manual iOS/Android/PWA checks.

If reviewed rules or extraction gate fails, the candidate stays private/limited and affected advice is disabled until corrected; do not fabricate passing results.
