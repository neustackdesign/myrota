#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="infra/cloudflare-gate1"
LIVE_URL="https://myrota.neustackdesign.workers.dev"
WIDGET_NAME="myrota-auth"

branch="$(git branch --show-current)"
if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
  echo "Refusing auth bootstrap: expected '$EXPECTED_BRANCH', got '$branch'." >&2
  exit 2
fi

echo "== Cloudflare identities =="
npx wrangler whoami >/dev/null
npx --yes cf auth whoami >/dev/null
echo "Wrangler + cf authentication present."

echo
echo "== Confirm current live Worker/D1 =="
health="$(curl --fail-with-body --silent --show-error "$LIVE_URL/api/health")"
printf '%s\n' "$health"
printf '%s' "$health" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.database!=="connected"||j.live!==true)process.exit(1)})'

echo
echo "== Find or create Managed Turnstile widget =="
widgets="$(npx --yes cf turnstile widgets list --filter "name:$WIDGET_NAME")"
sitekey="$(printf '%s' "$widgets" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const w=(Array.isArray(a)?a:[]).find(x=>x.name==="myrota-auth");if(w?.sitekey)process.stdout.write(w.sitekey)})')"
turnstile_secret="$(printf '%s' "$widgets" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const w=(Array.isArray(a)?a:[]).find(x=>x.name==="myrota-auth");if(w?.secret)process.stdout.write(w.secret)})')"

if [[ -z "$sitekey" ]]; then
  body="$(node -e 'process.stdout.write(JSON.stringify({name:"myrota-auth",domains:["myrota.neustackdesign.workers.dev","localhost"],mode:"managed",region:"world"}))')"
  created="$(npx --yes cf turnstile widgets create --body "$body")"
  sitekey="$(printf '%s' "$created" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.sitekey)process.exit(1);process.stdout.write(j.sitekey)})')"
  turnstile_secret="$(printf '%s' "$created" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.secret)process.exit(1);process.stdout.write(j.secret)})')"
  echo "Created Turnstile widget: $sitekey"
else
  echo "Found existing Turnstile widget: $sitekey"
fi

if [[ -z "$turnstile_secret" ]]; then
  echo "Turnstile secret was not returned by listing; rotating with the default two-hour grace period."
  rotated="$(npx --yes cf turnstile widgets rotate-secret "$sitekey")"
  turnstile_secret="$(printf '%s' "$rotated" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.secret)process.exit(1);process.stdout.write(j.secret)})')"
fi

better_secret="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64url"))')"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
BETTER_AUTH_SECRET="$better_secret" TURNSTILE_SITE_KEY="$sitekey" TURNSTILE_SECRET_KEY="$turnstile_secret" \
node -e '
const fs=require("fs");
const out={
  BETTER_AUTH_SECRET:process.env.BETTER_AUTH_SECRET,
  TURNSTILE_SITE_KEY:process.env.TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY:process.env.TURNSTILE_SECRET_KEY
};
fs.writeFileSync(process.argv[1],JSON.stringify(out));
' "$tmp"

echo
echo "== Install Worker secrets in one deployment =="
npx wrangler secret bulk "$tmp" --name myrota --config wrangler.d1.jsonc

echo
echo "== Verify live auth readiness =="
health="$(curl --fail-with-body --silent --show-error "$LIVE_URL/api/health")"
config="$(curl --fail-with-body --silent --show-error "$LIVE_URL/api/config")"
printf '%s\n' "$health"
printf '%s\n' "$config"
printf '%s' "$health" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.auth!=="anonymous-ready")process.exit(1)})'
printf '%s' "$config" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.turnstileSiteKey)process.exit(1)})'

echo
echo "PASS: Better Auth secret + Turnstile are installed and the live Worker reports anonymous-ready."
echo "Turnstile site key (public): $sitekey"
echo "Next gate: real browser Turnstile token -> anonymous session cookie -> shelf write/read."
