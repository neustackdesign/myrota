#!/usr/bin/env bash
set -euo pipefail
test "$(git branch --show-current)" = "feat/pilot-backend-d1" || { echo 'Wrong backend branch'; exit 2; }
test "$#" -eq 1 || { echo 'Pass the exact Vercel Preview https URL'; exit 2; }
origin="$1"
host="$(ORIGIN="$origin" node -e 'const u=new URL(process.env.ORIGIN);if(u.protocol!=="https:"||u.pathname!=="/"||u.search||u.hash||!/^myrota-[a-z0-9-]+-neustackdesign-gmailcoms-projects[.]vercel[.]app$/.test(u.hostname))process.exit(1);process.stdout.write(u.hostname)')" || { echo 'Refusing unapproved hostname'; exit 3; }
sitekey="$(curl -fsS https://myrota.neustackdesign.workers.dev/api/config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.turnstileSiteKey)process.exit(1);process.stdout.write(j.turnstileSiteKey)})')"
echo "Preview to authorize: $origin"
echo 'Existing Cloudflare Worker and localhost remain on Turnstile allowlist.'
read -r -p 'Authorize this preview origin (yes/no)? ' yes
test "$yes" = yes || exit 0
npx --yes cf turnstile widgets update "$sitekey" --name myrota-auth --domains myrota.neustackdesign.workers.dev --domains localhost --domains "$host"
printf '%s' "$origin" | npx wrangler secret put MYROTA_TRUSTED_ORIGINS --name myrota
curl -fsS https://myrota.neustackdesign.workers.dev/api/health
echo
echo 'Preview trusted by Turnstile and Better Auth. Real browser auth test next.'
