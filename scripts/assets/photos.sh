#!/usr/bin/env bash
# Photo pipeline for the v1.6 image slots. Requires ImageMagick 6/7 and curl.
#   scripts/assets/photos.sh fetch   <dir>            # download the 5 Pexels originals into <dir> (or drop them there as <id>.jpg)
#   scripts/assets/photos.sh sheet   <dir> <out.png>  # contact sheet: each candidate, its slots' briefs, crop previews
#   scripts/assets/photos.sh publish <dir> <ids...>   # ONLY the approved ids → public/media/*.webp|jpg + sha256 manifest
set -euo pipefail
IDS=(7269486 5938589 6579978 5938600 7269467)
declare -A KEY=([7269486]=landing-hero [5938589]=hands-serum [6579978]=friends [5938600]=milestone [7269467]=routine)
declare -A SLOTS=(
  [7269486]="lp4-shot1, photo-welcome — Woman, darker skin, mid-step at a mirror, cleanser in hand · evening lamp"
  [5938589]="lp4-shot2 — Hands with serum dropper above a sink, soft morning window light, label turned away"
  [6579978]="lp4-shot4, photo-invite, share-friend — Two friends, darker skin tones, natural candid warmth"
  [5938600]="lp4-shot6, photo-rota-complete — Close cheek texture, moisturiser pressed in, evening lamp / milestone portrait, warm daylight"
  [7269467]="lp4-shot10, share-ring-window — Older woman, darker skin, evening routine / circular crop behind ring"
)
MAGICK=$(command -v magick || command -v convert)
cmd=${1:-}; dir=${2:-}
case "$cmd" in
  fetch)
    mkdir -p "$dir"
    for id in "${IDS[@]}"; do
      curl -fsSL "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?cs=srgb&dl=pexels-$id.jpg&fm=jpg" -o "$dir/$id.jpg"
      echo "fetched $id ($(wc -c < "$dir/$id.jpg") bytes)"
    done ;;
  sheet)
    out=${3:?out.png}; tiles=()
    for id in "${IDS[@]}"; do
      f="$dir/$id.jpg"; [ -f "$f" ] || { echo "missing $f"; exit 3; }
      dims=$("$MAGICK" identify -format '%wx%h' "$f[0]" 2>/dev/null || identify -format '%wx%h' "$f")
      t="$dir/.tile-$id.png"
      "$MAGICK" "$f" -auto-orient -resize 520x650^ -gravity center -extent 520x650 \
        \( "$f" -auto-orient -resize 260x260^ -gravity center -extent 260x260 \) -gravity southeast -geometry +12+12 -composite \
        -background '#F7EFE7' -fill '#2A1911' -font DejaVu-Sans -pointsize 15 -gravity north -splice 0x120 \
        -annotate +0+10 "Pexels $id · ${dims}\n$(echo "${SLOTS[$id]}" | fold -s -w 64)" "$t"
      tiles+=("$t")
    done
    "$MAGICK" "${tiles[@]}" +append -bordercolor '#F7EFE7' -border 16 "$out"
    echo "contact sheet → $out" ;;
  publish)
    shift 2; [ $# -gt 0 ] || { echo "list the APPROVED pexels ids"; exit 2; }
    mkdir -p public/media; manifest=lib/assets/media.json; echo "{" > "$manifest.tmp"; first=1
    for id in "$@"; do
      k=${KEY[$id]:?unknown id $id}; f="$dir/$id.jpg"
      for w in 800 1600; do
        "$MAGICK" "$f" -auto-orient -strip -resize "${w}x${w}>" -quality 78 "public/media/$k-$w.webp"
      done
      "$MAGICK" "$f" -auto-orient -strip -resize '1600x1600>' -quality 80 -interlace Plane "public/media/$k-1600.jpg"
      sha=$(sha256sum "$f" | cut -c1-64); dims=$(identify -format '%wx%h' "$f")
      [ $first = 1 ] || echo "," >> "$manifest.tmp"; first=0
      printf '  "%s": {"pexelsId": %s, "originalSha256": "%s", "originalDims": "%s", "files": ["/media/%s-800.webp", "/media/%s-1600.webp", "/media/%s-1600.jpg"]}' "$k" "$id" "$sha" "$dims" "$k" "$k" "$k" >> "$manifest.tmp"
      echo "published $id → public/media/$k-*"
    done
    printf '\n}\n' >> "$manifest.tmp"; mv "$manifest.tmp" "$manifest"; sha256sum public/media/* ;;
  *) echo "usage: $0 fetch|sheet|publish <dir> …"; exit 2 ;;
esac
