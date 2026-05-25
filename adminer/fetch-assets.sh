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
PLUGINS=(plugin table-structure table-indexes-structure tables-filter designs)

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

# Designs. konya is the default view style (pinned to the v5.4.2 build — its
# CSS targets the same stable selectors and renders fine on 4.8.1); dracula is
# a dark theme offered in the switcher.
mkdir -p "$DIR/designs/konya" "$DIR/designs/dracula"
[ -f "$DIR/designs/konya/adminer.css" ] || dl "https://www.adminer.org/download/v5.4.2/designs/konya/adminer.css" "$DIR/designs/konya/adminer.css"
[ -f "$DIR/designs/dracula/adminer.css" ] || dl "$BASE/designs/dracula/adminer.css" "$DIR/designs/dracula/adminer.css"

echo "[adminer] assets ready in $DIR (adminer ${VER}, ${#PLUGINS[@]} plugins, konya+dracula designs)"
