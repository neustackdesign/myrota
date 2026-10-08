#!/usr/bin/env bash
set -euo pipefail

# Isolated pilot release for the existing myrota Worker + D1 only.
# This is NOT a product UI deployment and NEVER touches Vercel, Supabase,
# ApplyOS or Fleetpass.
EXPECTED_BRANCH="feat/pilot-backend-d1"
EXPECTED_DB_ID="7992c70c-171b-4a03-8b8f-e88d1fcba9c8"
LIVE_URL="https://myrota.neustackdesign.workers.dev"

fail() { echo "BLOCKED: $*" >&2; exit 1; }
test "$(git branch --show-current)" = "$EXPECTED_BRANCH" ||
  fail "Run from a worktree on $EXPECTED_BRANCH, not your UI checkout."

actual="$(sed -n 's/.*"database_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' wrangler.d1.jsonc | head -n 1)"
test "$actual" = "$EXPECTED_DB_ID" || fail "Wrong D1 UUID; never migrate another project's database."

echo "== Install dependencies in this isolated worktree if needed =="
if [[ ! -d node_modules ]]; then
  npm install --no-audit --no-fund
fi

echo "== Preflight identities =="
npx wrangler whoami
npx --yes cf auth whoami

echo "== Preflight product code BEFORE any remote database write =="
npm run typecheck
npm run test:domain
npm run build:vinext

echo "== Live API ready for a real guest? =="
health="$(curl -fsS "$LIVE_URL/api/health")" || fail "Worker is not healthy."
printf '%s\n' "$health"
printf '%s' "$health" | node -e '
let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{
 const j=JSON.parse(s);if(j.database!=="connected"||j.auth!=="anonymous-ready"||j.live!==true)process.exit(1)
})' || fail "Better Auth + Turnstile not yet configured. Complete Gate 1 before pilot release."

echo "== Confirm schema migration target and pending work =="
npx wrangler d1 migrations list myrota --remote --config wrangler.d1.jsonc
test -f db/migrations/0002_rota_and_day_records.sql ||
  fail "Reviewed rota migration missing."
read -r -p "Apply 0002 to EXISTING WEUR myrota D1 and deploy API? Type yes: " answer
test "$answer" = "yes" || fail "Cancelled (no write)."

echo "== Apply reviewed migrations =="
npx wrangler d1 migrations apply myrota --remote --config wrangler.d1.jsonc

echo "== Verify exact remote tables =="
out="$(npx wrangler d1 execute myrota --remote --config wrangler.d1.jsonc --command \
  "SELECT name FROM sqlite_master WHERE name IN ('rota_snapshots','day_records') ORDER BY name;")"
printf '%s\n' "$out"
for table in rota_snapshots day_records; do
  grep -q "\"$table\"" <<< "$out" || fail "Missing new D1 table: $table"
done

echo "== Deploy existing Worker with real API routes =="
NEXT_PUBLIC_MYROTA_DEMO=0 npx --yes @vinext/cloudflare deploy

echo "== Verify live API after deployment =="
curl -fsS "$LIVE_URL/api/health"; echo
curl -fsS "$LIVE_URL/api/catalogue?q=serum"; echo
echo "Backend deployed, schema present. Next gate is REAL COOKIE + SHELF + ROTA + COMPLETION browser test."
echo "Do NOT declare product live until Vercel Preview proxy and browser state tests pass."
