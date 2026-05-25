#!/usr/bin/env bash
#
# Local Adminer launcher for `npm run dev`.
#
# Adminer needs the SQLite *file* on its own filesystem (it can't dial a remote
# SQLite "server" the way MailDev dials SMTP). Locally the backend uses the
# wrangler/D1 miniflare SQLite file, so we resolve that path and hand it to the
# same custom Adminer entrypoint the deployed container uses (adminer/index.php).
#
# Serving strategy, best-effort and in order:
#   1. `php`   — serve adminer/ with PHP's built-in server (no extra services).
#   2. Docker  — fall back to the official `adminer` image with the DB mounted.
#   3. neither — print a hint and exit 0 so the rest of `npm run dev` keeps
#                running (concurrently doesn't kill siblings here).
#
# Env overrides:
#   ADMINER_PORT      web port (default 8080)
#   ADMINER_PASSWORD  login password (default "edustack")
#   ADMINER_DB_PATH   force a specific SQLite file instead of auto-detecting
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMINER_DIR="$ROOT_DIR/adminer"
ADMINER_VERSION="4.8.1"
ADMINER_PORT="${ADMINER_PORT:-8080}"
ADMINER_PASSWORD="${ADMINER_PASSWORD:-edustack}"

# ─── Resolve the local SQLite file ──────────────────────────────────────────
# The backend auto-detects the wrangler miniflare D1 file; mirror that here.
resolve_db_path() {
  if [ -n "${ADMINER_DB_PATH:-}" ]; then
    echo "$ADMINER_DB_PATH"
    return
  fi
  local d1_dir="$ROOT_DIR/apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  if [ -d "$d1_dir" ]; then
    # The data DB is the larger *.sqlite that isn't miniflare's metadata file.
    local f
    f=$(ls -S "$d1_dir"/*.sqlite 2>/dev/null | grep -v 'metadata.sqlite' | head -n1)
    if [ -n "$f" ]; then
      echo "$f"
      return
    fi
  fi
  # Fall back to DATABASE_URL (file:./dev.db) relative to the backend app.
  local url="${DATABASE_URL:-file:./dev.db}"
  local rel="${url#file:}"
  ( cd "$ROOT_DIR/apps/backend" && echo "$(pwd)/${rel#./}" )
}

DB_PATH="$(resolve_db_path)"

if [ ! -f "$DB_PATH" ]; then
  echo "[adminer] ⚠ no local SQLite DB found yet at: $DB_PATH"
  echo "[adminer]   Run the backend once (npm run dev) or 'npm run db:init' to create it."
  echo "[adminer]   Adminer will still start; reconnect once the file exists."
fi

# ─── Fetch the Adminer binary if missing ────────────────────────────────────
fetch_adminer() {
  [ -f "$ADMINER_DIR/adminer.php" ] && return 0
  local url="https://github.com/vrana/adminer/releases/download/v${ADMINER_VERSION}/adminer-${ADMINER_VERSION}.php"
  echo "[adminer] downloading Adminer ${ADMINER_VERSION}…"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$ADMINER_DIR/adminer.php"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$ADMINER_DIR/adminer.php" "$url"
  else
    echo "[adminer] ✗ need curl or wget to download Adminer — skipping."
    return 1
  fi
}

# ─── Serve ───────────────────────────────────────────────────────────────────
if command -v php >/dev/null 2>&1; then
  if ! fetch_adminer; then exit 0; fi
  echo "[adminer] ➜ http://127.0.0.1:${ADMINER_PORT}  (password: ${ADMINER_PASSWORD})"
  echo "[adminer]   SQLite file: ${DB_PATH}"
  ADMINER_DB_PATH="$DB_PATH" ADMINER_PASSWORD="$ADMINER_PASSWORD" \
    exec php -d display_errors=1 -S "127.0.0.1:${ADMINER_PORT}" -t "$ADMINER_DIR"
elif command -v docker >/dev/null 2>&1; then
  if ! fetch_adminer; then exit 0; fi
  echo "[adminer] ➜ http://127.0.0.1:${ADMINER_PORT}  (password: ${ADMINER_PASSWORD})"
  echo "[adminer]   SQLite file mounted read-write from: ${DB_PATH}"
  # Mount our custom index.php + the fetched binary, plus the DB file, into the
  # official PHP+Adminer-capable image. The DB lands at /db/edustack.db inside.
  exec docker run --rm --name edustack-adminer \
    -p "127.0.0.1:${ADMINER_PORT}:8080" \
    -e "ADMINER_DB_PATH=/db/$(basename "$DB_PATH")" \
    -e "ADMINER_PASSWORD=${ADMINER_PASSWORD}" \
    -v "$ADMINER_DIR:/var/www/html:ro" \
    -v "$DB_PATH:/db/$(basename "$DB_PATH")" \
    php:8.2-cli \
    php -d display_errors=1 -S 0.0.0.0:8080 -t /var/www/html
else
  echo "[adminer] ✗ neither php nor docker found — Adminer not started."
  echo "[adminer]   Install PHP (brew install php) or Docker to enable the DB viewer."
  exit 0
fi
