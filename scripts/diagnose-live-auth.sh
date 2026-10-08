#!/usr/bin/env bash
# One-shot production auth diagnosis for the EXISTING myrota Cloudflare Worker.
# Never modifies D1 schema, rotates secrets, bypasses Turnstile, or merges PRs.
set -euo pipefail
cd "$(dirname "$0")/.."
EXPECTED_BRANCH="feat/pilot-backend-d1"
LIVE_URL="https://myrota.neustackdesign.workers.dev"
branch="$(git branch --show-current)"
[[ "$branch" == "$EXPECTED_BRANCH" ]] || { echo "BLOCKED: checkout $EXPECTED_BRANCH in a separate worktree first (currently $branch)." >&2; exit 2; }
git diff --quiet && git diff --cached --quiet || { echo "BLOCKED: uncommitted work; stash or commit it before deploying." >&2; exit 2; }
command -v node >/dev/null || { echo "Node.js is required." >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required." >&2; exit 2; }

echo "== Verify Cloudflare login and current project =="
npx wrangler whoami >/dev/null
echo "== Build and validate candidate =="
npm ci --no-audit --no-fund
npm run typecheck
npm run test:domain
npm run build:vinext

echo "== Deploy current backend branch to existing Worker, no schema writes =="
NEXT_PUBLIC_MYROTA_DEMO=0 npx --yes @vinext/cloudflare deploy
echo "== Check live runtime =="
curl -fsS "$LIVE_URL/api/health" | node -e '
let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{
 const j=JSON.parse(s); console.log(JSON.stringify(j));
 if(j.runtime!=="cloudflare-worker"||j.database!=="connected"||j.auth!=="anonymous-ready")process.exitCode=1;
})'

echo "== Start live log stream; only tagged auth diagnostics will be printed =="
log_file="$(mktemp)"
tail_pid=""
cleanup(){ [[ -z "$tail_pid" ]] || kill "$tail_pid" 2>/dev/null || true; rm -f "$log_file"; }
trap cleanup EXIT
npx wrangler tail myrota --format json >"$log_file" 2>&1 &
tail_pid="$!"
sleep 6
if ! kill -0 "$tail_pid" 2>/dev/null; then
 echo "Log stream could not start; check Wrangler permissions." >&2
 exit 3
fi

echo
echo "Now open a PRIVATE browser window and run the auth smoke ONCE:"
echo "    $LIVE_URL/gate1/auth-smoke"
if command -v open >/dev/null; then open "$LIVE_URL/gate1/auth-smoke"; fi
read -r -p "Once the test has finished, press Enter here to print the diagnostic category... "
sleep 6
echo "== Sanitized Worker auth diagnostics =="
node - "$log_file" <<'NODE'
const fs=require("node:fs");
const rows=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/);
let found=0;
for(const row of rows){
  if(!row.includes("[myrota.auth"))continue;
  const tag=row.includes("[myrota.auth.internal]")?"better-auth-internal":"outer-route";
  const category=(row.match(/(?:database|origin-or-csrf|session-or-secret|other)/)||[])[0]||"unclassified";
  const hint=(row.match(/(?:missing-column|missing-table|constraint|unsupported|inspect-local-repro)/)||[])[0]||"unknown";
  const reqMethod=(row.match(/(?:GET|POST|PATCH|DELETE)/)||[])[0]||"request";
  console.log(JSON.stringify({tag,category,hint,method:reqMethod}));
  found++;
}
if(!found)console.log("No tagged errors found. Confirm smoke finished after tail started and this Worker version was deployed. Do not paste raw log lines containing personal data.");
NODE
echo "== Done. Share only the sanitized diagnostic category above, not secrets or full logs. =="
