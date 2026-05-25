#!/usr/bin/env bash
#
# Download the Adminer binary + plugins + designs that the EduStack wrapper
# (index.php) loads. These are third-party files we don't vendor into git —
# fetched once at Docker build time and on first local `npm run dev`.
#
# Usage: fetch-assets.sh [TARGET_DIR]   (defaults to this script's directory)
set -euo pipefail

DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
VER="4.8.1"
BASE="https://raw.githubusercontent.com/vrana/adminer/v${VER}"

# Adminer 4.8.1-compatible plugins (non-namespaced API). dark-switcher is
# intentionally omitted: it only exists for Adminer 5.x and would fatal here —
# dark mode is provided through the dark designs below instead.
PLUGINS=(plugin table-structure table-indexes-structure tables-filter designs login-password-less)
# konya = requested alternative design; dracula is a dark theme that stands in
# for the (5.x-only) dark-switcher plugin.
DESIGNS=(konya dracula)

dl() { # dl <url> <dest>
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    echo "[adminer] ✗ need curl or wget to download Adminer assets" >&2
    return 1
  fi
}

mkdir -p "$DIR/plugins" "$DIR/designs"

[ -f "$DIR/adminer.php" ] || dl "https://github.com/vrana/adminer/releases/download/v${VER}/adminer-${VER}.php" "$DIR/adminer.php"

for p in "${PLUGINS[@]}"; do
  [ -f "$DIR/plugins/$p.php" ] || dl "$BASE/plugins/$p.php" "$DIR/plugins/$p.php"
done

for d in "${DESIGNS[@]}"; do
  mkdir -p "$DIR/designs/$d"
  [ -f "$DIR/designs/$d/adminer.css" ] || dl "$BASE/designs/$d/adminer.css" "$DIR/designs/$d/adminer.css"
done

echo "[adminer] assets ready in $DIR (adminer ${VER}, ${#PLUGINS[@]} plugins, ${#DESIGNS[@]} designs)"
