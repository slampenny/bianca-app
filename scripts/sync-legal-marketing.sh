#!/usr/bin/env bash
# Copy packages/legal → marketing WordPress theme (and optional wp-dev packaged theme).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/packages/legal"
DEST="$ROOT/packages/marketing/wordpress/wp-content/themes/bianca-wellness/data/legal"

mkdir -p "$DEST"
cp "$SRC"/*.md "$SRC/pages.json" "$DEST/"

echo "Synced legal docs → $DEST"

WPDEV_THEME="${WPDEV_THEME:-$ROOT/../wp-dev/packaged-themes/bianca-wellness/data/legal}"
if [[ -d "$(dirname "$WPDEV_THEME")" ]]; then
  mkdir -p "$WPDEV_THEME"
  cp "$SRC"/*.md "$SRC/pages.json" "$WPDEV_THEME/"
  echo "Synced legal docs → $WPDEV_THEME"
fi
