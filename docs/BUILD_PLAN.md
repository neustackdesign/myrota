# Build plan

## Now

- [x] Initialise repo
- [x] Establish product contract
- [x] Build PWA shell
- [x] Seed 15 development products
- [x] Add deterministic rota generator
- [x] Add Today / week strip
- [x] Add AM/PM completion
- [x] Add streak calculation
- [x] Add Rota Rescue
- [x] Add Shelf Check
- [x] Add Mix Check
- [x] Add share / invite surface
- [ ] Pass typecheck/build
- [ ] Commit lockfile

## Backend pass

- [ ] Connect Supabase project
- [ ] Enable anonymous auth
- [ ] Cookie-based SSR auth
- [ ] Create schema through CLI migration
- [ ] Add RLS
- [ ] Replace browser storage behind repository interface
- [ ] Real invite records
- [ ] Friend streak state
- [ ] Invite acceptance
- [ ] Anonymous → claimed account upgrade

## Acquisition / retention pass

- [ ] PWA install prompt
- [ ] iOS install education
- [ ] Web Push after install
- [ ] Milestone share cards
- [ ] Dynamic OG cards
- [ ] Analytics events
- [ ] WhatsApp invite copy variants

## Intelligence workstream

- [ ] 100-product Lagos/Dubai benchmark
- [ ] 20-shelf routine benchmark
- [ ] Rule evidence review
- [ ] Catalogue provenance
- [ ] Ingredient photo ingestion
- [ ] Unknown/partial product states

## First live test

10 real users.

Test loop:

```
add → rota → start → complete → invite → friend starts
```

Do not widen scope before observing this loop.
