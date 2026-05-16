#!/usr/bin/env bash
set -euo pipefail

DB_FILE="${DATABASE_URL#file:}"
DB_FILE="${DB_FILE:-/data/edustack.db}"

if [ ! -s "$DB_FILE" ]; then
  echo "[start] no DB at $DB_FILE — initialising from schema.sql"
  mkdir -p "$(dirname "$DB_FILE")"
  sqlite3 "$DB_FILE" < /app/apps/backend/src/database/schema.sql
fi

echo "[start] launching MCP server on ${MCP_HOST:-127.0.0.1}:${MCP_PORT:-3001}"
( cd /app/apps/mcp-server && node dist/index.js ) &
MCP_PID=$!

echo "[start] launching backend on ${HOST:-0.0.0.0}:${PORT:-3000}"
( cd /app/apps/backend && node dist/src/main.js ) &
BACKEND_PID=$!

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
