#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="infra/cloudflare-gate1"
EXPECTED_DB_ID="7992c70c-171b-4a03-8b8f-e88d1fcba9c8"

branch="$(git branch --show-current)"
if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
  echo "Refusing remote migration: expected branch '$EXPECTED_BRANCH', got '$branch'." >&2
  echo "Use the dedicated myrota-infra worktree; do not apply from the UI branch." >&2
  exit 2
fi

actual_id="$(node -e 'const fs=require("fs"); const s=fs.readFileSync("wrangler.jsonc","utf8").replace(/\\/\\/.*$/gm,""); const c=JSON.parse(s); process.stdout.write(c.d1_databases?.find(x=>x.database_name==="myrota")?.database_id||"")')"
if [[ "$actual_id" != "$EXPECTED_DB_ID" ]]; then
  echo "Refusing remote migration: myrota D1 UUID mismatch." >&2
  echo "Expected: $EXPECTED_DB_ID" >&2
  echo "Found:    ${actual_id:-<none>}" >&2
  exit 3
fi

if [[ ! -f db/migrations/0001_initial.sql ]]; then
  echo "Reviewed initial migration is missing." >&2
  exit 4
fi

echo "== Cloudflare identity =="
npx wrangler whoami

echo
echo "== Pending migrations for myrota =="
npx wrangler d1 migrations list myrota --remote

echo
echo "== Applying reviewed migrations to WEUR myrota D1 =="
npx wrangler d1 migrations apply myrota --remote

echo
echo "== Verifying remote schema =="
out="$(npx wrangler d1 execute myrota --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")"
printf '%s\n' "$out"
for table in user session account verification shelf_items account_merge_jobs; do
  if ! grep -q "\"$table\"" <<<"$out"; then
    echo "Remote verification failed: expected table '$table' not found." >&2
    exit 5
  fi
done

echo
echo "PASS: reviewed initial schema is present on the dedicated myrota D1 database."
