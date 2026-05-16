#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${DATABASE_URL#file:}"
DB_FILE="${DB_FILE:-/data/edustack.db}"

needs_init=0
if [ ! -s "$DB_FILE" ]; then
  echo "[start] no DB at $DB_FILE — initialising from schema.sql"
  needs_init=1
elif ! sqlite3 "$DB_FILE" "SELECT 1" >/dev/null 2>&1; then
  # File exists but isn't a valid SQLite database (SQLITE_NOTADB). Without this
  # branch the backend opens it, the first query throws, the process exits, and
  # Fly burns through its restart budget. Move the bad file aside (don't delete
  # — leave it for forensics) and re-seed.
  CORRUPT_PATH="${DB_FILE}.corrupt-$(date +%s)"
  echo "[start] DB at $DB_FILE is corrupt — moving to $CORRUPT_PATH and re-initialising"
  mv "$DB_FILE" "$CORRUPT_PATH"
  needs_init=1
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

shutdown() {
  echo "[start] shutting down…"
  kill -TERM "$MCP_PID" "$BACKEND_PID" 2>/dev/null || true
  wait || true
}
trap shutdown TERM INT

wait -n
echo "[start] one process exited, terminating the other"
shutdown
exit 1
