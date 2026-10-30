# D1 persistence — Gate 1

Source: `db/schema.ts`. Better Auth auth tables are deliberately not guessed; generate with Better Auth CLI from installed package/config when wiring the auth layer.

`shelf_items` and `account_merge_jobs` are the minimum vertical slice. No clinical rule table is published. The schema must be generated as a Drizzle migration and checked against D1 *locally* before touching an actual Cloudflare account.

- `owner_user_id` always derives from authenticated server session, never submitted request data.
- `identity_key` nullable; unique per user when verified. No unsafe auto-dedup of distinct product variants.
- ingredient JSON/provenance is initially a verified/extracted candidate, not a medical approval.
- `account_merge_jobs` captures an idempotency state; the actual guest→existing merge transaction MUST be written/tested before deleting guests, not implied by the table.
- All tabular schema will remain inside the dedicated `myrota` D1 database, never in ApplyOS.
