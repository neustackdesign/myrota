#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="infra/cloudflare-gate1"
EXPECTED_DB_ID="7992c70c-171b-4a03-8b8f-e88d1fcba9c8"

branch="$(git branch --show-current)"
if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
  echo "Refusing deploy: expected '$EXPECTED_BRANCH', got '$branch'." >&2
  exit 2
fi

actual_id="$(sed -n 's/.*"database_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' wrangler.jsonc | head -n 1)"
if [[ "$actual_id" != "$EXPECTED_DB_ID" ]]; then
  echo "Refusing deploy: bound D1 UUID does not match dedicated WEUR myrota DB." >&2
  exit 3
fi

echo "== Cloudflare identity =="
npx wrangler whoami

if [[ ! -d node_modules ]]; then
  echo
  echo "== Installing infra dependencies without creating the final integration lockfile =="
  npm install --package-lock=false
fi

echo
echo "== Vinext production build (DEMO explicitly off) =="
NEXT_PUBLIC_MYROTA_DEMO=0 npm run build:vinext

echo
echo "== Deploying myrota Worker =="
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
npx wrangler deploy | tee "$tmp"

url="$(grep -Eo 'https://[^[:space:]]+\.workers\.dev[^[:space:]]*' "$tmp" | tail -n 1 | sed 's/[),]$//' || true)"
if [[ -z "$url" ]]; then
  echo
  echo "Deployment finished, but the workers.dev URL could not be parsed automatically."
  echo "Copy the URL from the Wrangler output and run:"
  echo "  curl -i https://YOUR-WORKER.workers.dev/api/health"
  exit 0
fi

echo
echo "== Live health =="
curl --fail-with-body --silent --show-error "$url/api/health"
echo

echo
echo "== Public client config (no secrets) =="
curl --fail-with-body --silent --show-error "$url/api/config"
echo

echo
echo "PASS: Worker deployed and live D1 health endpoint responded at $url"
echo "Auth is expected to remain configuration-pending until Better Auth secret + Turnstile are installed."
