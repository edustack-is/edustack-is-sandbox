# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20

# ─── Build stage ────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm ci --ignore-scripts && npm rebuild better-sqlite3

COPY apps/backend apps/backend
COPY apps/mcp-server apps/mcp-server

RUN npm run build --workspace=backend --workspace=mcp-server

# ─── Runtime stage ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

# php-cli + php-sqlite3 power Adminer (the DB viewer); curl fetches its binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini sqlite3 ca-certificates curl php-cli php-sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild better-sqlite3 \
    && npm cache clean --force

COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/src/database/schema.sql apps/backend/src/database/schema.sql
COPY --from=build /app/apps/mcp-server/dist apps/mcp-server/dist

COPY scripts/start.sh /app/scripts/start.sh
RUN chmod +x /app/scripts/start.sh && mkdir -p /data

# Adminer (SQLite DB viewer). Runs as a second process from start.sh, reachable
# on the db-<env> service port. The single-file binary is fetched at build time
# (it is gitignored, never committed); index.php pins it to our SQLite file.
ARG ADMINER_VERSION=4.8.1
COPY adminer/index.php /app/adminer/index.php
RUN curl -fsSL "https://github.com/vrana/adminer/releases/download/v${ADMINER_VERSION}/adminer-${ADMINER_VERSION}.php" \
      -o /app/adminer/adminer.php

# Build metadata. Both default to "unknown" so local `docker build` without
# --build-arg still works; CI passes real values from github.sha and an ISO
# UTC timestamp at deploy time so the status page and /api/health can
# identify what's actually running.
ARG COMMIT_SHA=unknown
ARG BUILD_TIME=unknown

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    MCP_PORT=3001 \
    MCP_HOST=127.0.0.1 \
    DATABASE_URL=file:/data/edustack.db \
    ADMINER_PORT=8080 \
    ADMINER_DB_PATH=/data/edustack.db \
    COMMIT_SHA=$COMMIT_SHA \
    BUILD_TIME=$BUILD_TIME

EXPOSE 3000 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/scripts/start.sh"]
