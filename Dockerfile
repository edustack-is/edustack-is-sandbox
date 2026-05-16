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

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini sqlite3 ca-certificates \
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

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    MCP_PORT=3001 \
    MCP_HOST=127.0.0.1 \
    DATABASE_URL=file:/data/edustack.db

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/scripts/start.sh"]
