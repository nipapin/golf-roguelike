#!/usr/bin/env bash
# Builds WebP atlases for the CraftPix chibi monsters (OGA-BY 3.0, see CREDITS.md).
# Usage: scripts/build-chibi-atlases.sh <path-to/craftpix-chibi-monsters>
# Output: public/assets/enemies/atlases/<key>.webp + .json (160px cells by default, 8 columns).
# Frame layout per atlas: idle 0-5, attack 6-11, hurt 12-15, dead 16-21 (mirrored in enemies.json "sprites").
set -euo pipefail
SRC="${1:?source dir}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/assets/enemies/atlases"
CELL=${CELL:-160}; COLS=8
declare -A KEYS=( [Goblin]=c_goblin [Orc]=c_orc [Ogre]=c_ogre [Reaper_Man_1]=c_reaper1 [Reaper_Man_2]=c_reaper2 [Reaper_Man_3]=c_reaper3 [Fallen_Angels_1]=c_angel1 [Fallen_Angels_2]=c_angel2 [Fallen_Angels_3]=c_angel3 )
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for dir in "${!KEYS[@]}"; do
  key=${KEYS[$dir]}; seq="$SRC/$dir/PNG/PNG Sequences"
  pick() { ls "$seq/$1"/*.png | sort | awk -v s="$2" 'BEGIN{n=split(s,a,",");for(i=1;i<=n;i++)w[a[i]]=1} w[NR-1]'; }
  mapfile -t frames < <(pick Idle 0,3,6,9,12,15; pick Slashing 0,2,4,6,8,10; pick Hurt 0,3,6,9; pick Dying 0,3,6,9,12,14)
  # Shared trim box (so the character does not jitter between frames).
  bbox=$(convert "${frames[@]}" -background none -layers merge -trim -format '%wx%h%O' info:)
  w=${bbox%%x*}; rest=${bbox#*x}; h=${rest%%[+-]*}; side=$(( w>h ? w : h ))
  i=0; outs=()
  for f in "${frames[@]}"; do
    o=$(printf "%s/%03d.png" "$TMP" $i)
    convert "$f" -crop "$bbox" +repage -background none -gravity south -extent "${side}x${side}" -resize "${CELL}x${CELL}" "$o"
    outs+=("$o"); i=$((i+1))
  done
  n=$i; rows=$(( (n + COLS - 1) / COLS ))
  montage "${outs[@]}" -background none -tile "${COLS}x${rows}" -geometry "${CELL}x${CELL}+0+0" "$TMP/sheet.png"
  convert "$TMP/sheet.png" -define webp:alpha-quality=80 -define webp:method=6 -quality ${QUALITY:-72} "$OUT/$key.webp"
  { echo '{"frames":{'; for ((j=0;j<n;j++)); do x=$(( (j%COLS)*CELL )); y=$(( (j/COLS)*CELL )); sep=$([ $j -lt $((n-1)) ] && echo , || true); printf '"%s_%03d":{"frame":{"x":%d,"y":%d,"w":%d,"h":%d}}%s\n' "$key" $j $x $y $CELL $CELL "$sep"; done
    printf '},"meta":{"image":"%s.webp","size":{"w":%d,"h":%d},"scale":"1","source":"CraftPix.net chibi monsters (OGA-BY 3.0)"}}\n' "$key" $((COLS*CELL)) $((rows*CELL)); } > "$OUT/$key.json"
  echo "$key: $n frames, $(stat -c%s "$OUT/$key.webp") bytes"
done
