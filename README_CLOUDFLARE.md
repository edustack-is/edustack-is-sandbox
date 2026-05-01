# Deployment Guide – EduStack IS

This application supports two execution modes: **Local (SQLite)** and **Cloudflare (Workers/D1)**.

## Environment Configuration

Use the `DB_ADAPTER` environment variable to switch between modes:

- `DB_ADAPTER=sqlite`: Uses local SQLite file via `better-sqlite3`.
- `DB_ADAPTER=d1`: Uses Cloudflare D1 (automatically detected in Workers).

## 1. Cloudflare D1 (SQLite Mode)

To deploy to Cloudflare:

```bash
# 1. Create D1 database
wrangler d1 create edustack_db

# 2. Push schema to D1
wrangler d1 execute edustack_db --file=./apps/backend/prisma/schema.sql
```

Update the `database_id` in `apps/backend/wrangler.toml`.
