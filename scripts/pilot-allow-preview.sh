#!/usr/bin/env bash
set -euo pipefail
test "$(git branch --show-current)" = "feat/pilot-backend-d1" || { echo 'Wrong backend branch'; exit 2; }
test "$#" -eq 1 || { echo 'Pass the exact Vercel Preview https URL'; exit 2; }
origin="$1"
host="$(ORIGIN="$origin" node -e 'const u=new URL(process.env.ORIGIN);if(u.protocol!=="https:"||u.pathname!=="/"||u.search||u.hash||!/^myrota-[a-z0-9-]+-neustackdesign-gmailcoms-projects[.]vercel[.]app$/.test(u.hostname))process.exit(1);process.stdout.write(u.hostname)')" || { echo 'Refusing unapproved hostname'; exit 3; }
sitekey="$(curl -fsS https://myrota.neustackdesign.workers.dev/api/config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.turnstileSiteKey)process.exit(1);process.stdout.write(j.turnstileSiteKey)})')"
echo "Preview to authorize: $origin"
echo 'Reading existing Turnstile domains; no domains will be removed.'
details="$(npx --yes cf turnstile widgets get "$sitekey")" || { echo 'Cannot load widget. No changes made.'; exit 4; }
domains="$(DETAILS="$details" PREVIEW_HOST="$host" node -e 'const j=JSON.parse(process.env.DETAILS);const v=Array.isArray(j.domains)?j:(j.result||{});const d=v.domains;if(!Array.isArray(d)||!d.includes("myrota.neustackdesign.workers.dev"))process.exit(1);process.stdout.write([...new Set([...d,process.env.PREVIEW_HOST])].join("\n"))')" || { echo 'Cannot safely preserve Turnstile domains. No changes made.'; exit 4; }
printf 'Allowed domains:\n%s\n' "$domains"
read -r -p 'Authorize this preview origin (yes/no)? ' yes
test "$yes" = yes || exit 0
args=(npx --yes cf turnstile widgets update "$sitekey" --name myrota-auth)
while IFS= read -r domain; do if [[ -n "$domain" ]]; then args+=(--domains "$domain"); fi; done <<< "$domains"
"${args[@]}"
# Dedicated test Preview only; this replaces the prior preview-origin secret.
printf '%s' "$origin" | npx wrangler secret put MYROTA_TRUSTED_ORIGINS --name myrota
curl -fsS https://myrota.neustackdesign.workers.dev/api/health
echo
echo 'Preview trusted by Turnstile and Better Auth. Real browser auth test next.'
