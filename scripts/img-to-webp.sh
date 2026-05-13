#!/usr/bin/env bash
# Convert PNG/JPG images to WebP using cwebp.
# Usage:
#   scripts/img-to-webp.sh <path>                # convert (keep originals)
#   scripts/img-to-webp.sh <path> --replace      # convert and delete the source
#   scripts/img-to-webp.sh <path> -q <quality>   # override quality (default 82)
#
#   <path> may be a file or a directory (recursed).
# Output: <same-path>.webp next to the source.

set -euo pipefail

if ! command -v cwebp >/dev/null 2>&1; then
  echo "error: cwebp not found. Install with: brew install webp" >&2
  exit 1
fi

target=""
quality=82
replace=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --replace) replace=1; shift ;;
    -q|--quality) quality="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "error: unknown flag $1" >&2
      exit 1
      ;;
    *)
      if [[ -z "$target" ]]; then target="$1"; else echo "error: extra arg $1" >&2; exit 1; fi
      shift
      ;;
  esac
done

if [[ -z "$target" ]]; then
  echo "usage: $0 <file-or-dir> [--replace] [-q quality]" >&2
  exit 1
fi

convert_one() {
  local src="$1"
  local out="${src%.*}.webp"
  local before after saved pct

  before=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src")
  cwebp -quiet -q "$quality" -metadata none "$src" -o "$out"
  after=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
  saved=$((before - after))
  pct=$(awk "BEGIN { printf \"%.0f\", ($saved / $before) * 100 }")

  printf "%-60s %7d B → %7d B  (-%s%%)\n" "$src" "$before" "$after" "$pct"

  if [[ $replace -eq 1 ]]; then
    rm "$src"
  fi
}

if [[ -d "$target" ]]; then
  while IFS= read -r -d '' file; do
    convert_one "$file"
  done < <(find "$target" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0)
elif [[ -f "$target" ]]; then
  convert_one "$target"
else
  echo "error: $target is not a file or directory" >&2
  exit 1
fi
