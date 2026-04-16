# Deployment Guide – EduStack IS

This application supports two execution modes: **Docker/Local (Postgres/SQLite)** and **Cloudflare (Workers/D1)**.

## Environment Configuration

Use the `DB_ADAPTER` environment variable to switch between modes:
- `DB_ADAPTER=native`: (Default) Uses PostgreSQL (TCP), perfect for Docker.
- `DB_ADAPTER=sqlite`: Uses local SQLite file via `better-sqlite3`.
- `DB_ADAPTER=d1`: Uses Cloudflare D1 (automatically detected in Workers).

## 1. Cloudflare D1 (SQLite Mode)

To deploy to Cloudflare, use the SQLite-compatible schema:
```bash
# 1. Generate client for SQLite
npx prisma generate --schema=./apps/backend/prisma/schema_sqlite.prisma

# 2. Create D1 database
wrangler d1 create edustack_db

# 3. Push schema to D1
wrangler d1 execute edustack_db --file=./apps/backend/prisma/schema.sql
```

Update the `database_id` in `apps/backend/wrangler.toml`.

## 2. Docker Mode (Postgres Mode)

By default, the application uses PostgreSQL. Ensure `DATABASE_URL` points to your Postgres instance.
```bash
# Generate client for Postgres (default)
npx prisma generate
```

## Prisma Usage
The `PrismaService` is now smart enough to load the correct driver adapter at runtime. You don't need to change any business logic code to switch between Cloudflare and Docker.
