#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${DATABASE_URL#file:}"
DB_FILE="${DB_FILE:-/data/edustack.db}"

needs_init=0
if [ ! -s "$DB_FILE" ]; then
  echo "[start] no DB at $DB_FILE — initialising from schema.sql"
  needs_init=1
else
  # Force a real header + page scan. `SELECT 1` alone isn't sufficient — on
  # some sqlite builds it's a constant SELECT that succeeds without touching
  # data pages, so a corrupt-but-openable file slips through. quick_check is
  # cheap (no cross-page integrity work) and prints "ok" on a healthy DB.
  echo "[start] validating DB at $DB_FILE"
  check_output=$(sqlite3 "$DB_FILE" "PRAGMA quick_check" 2>&1) || true
  if [ "$check_output" != "ok" ]; then
    CORRUPT_PATH="${DB_FILE}.corrupt-$(date +%s)"
    echo "[start] DB at $DB_FILE failed quick_check — moving to $CORRUPT_PATH and re-initialising"
    echo "[start] sqlite3 said: $check_output"
    mv "$DB_FILE" "$CORRUPT_PATH"
    needs_init=1
  fi
fi

if [ "$needs_init" = 1 ]; then
  mkdir -p "$(dirname "$DB_FILE")"
  sqlite3 "$DB_FILE" < /app/apps/backend/src/database/schema.sql
fi

echo "[start] launching backend on ${HOST:-0.0.0.0}:${PORT:-3000}"
( cd /app/apps/backend && node dist/src/main.js ) &
BACKEND_PID=$!

# Stagger MCP boot — on shared-cpu-1x, two Node processes starting at the
# same instant stretch the backend's first log line past 60s, which loses
# to Fly's restart timeout. AiChatService retries the MCP connection
# (attempt 1/10), so the MCP arriving a few seconds late is fine.
sleep 5

echo "[start] launching MCP server on ${MCP_HOST:-127.0.0.1}:${MCP_PORT:-3001}"
( cd /app/apps/mcp-server && node dist/index.js ) &
MCP_PID=$!

# Adminer (SQLite DB viewer) — only when a password gate is configured, so it
# is never exposed unauthenticated. It's a developer convenience, so it's
# best-effort: `disown` keeps a crash here from tripping the `wait -n` below
# and taking down the backend. ADMINER_DB_PATH/ADMINER_PASSWORD come from env.
ADMINER_PID=""
if [ -n "${ADMINER_PASSWORD:-}" ] && [ -f /app/adminer/adminer.php ]; then
  echo "[start] launching Adminer on 0.0.0.0:${ADMINER_PORT:-8080} (db ${ADMINER_DB_PATH:-$DB_FILE})"
  ADMINER_DB_PATH="${ADMINER_DB_PATH:-$DB_FILE}" \
    php -d display_errors=0 -S "0.0.0.0:${ADMINER_PORT:-8080}" -t /app/adminer &
  ADMINER_PID=$!
  disown "$ADMINER_PID" 2>/dev/null || true
else
  echo "[start] Adminer disabled (ADMINER_PASSWORD unset) — skipping"
fi

shutdown() {
  echo "[start] shutting down…"
  kill -TERM "$MCP_PID" "$BACKEND_PID" ${ADMINER_PID:+"$ADMINER_PID"} 2>/dev/null || true
  wait || true
}
trap shutdown TERM INT

wait -n
echo "[start] one process exited, terminating the other"
shutdown
exit 1
