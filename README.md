# EduStack IS

School information system for primary and secondary schools. Monorepo with a backend (NestJS), frontend (React) and an MCP server for AI agents.

## Info website

A public information website is already deployed at **https://is-edustack.org/**. It serves as the landing/marketing page for the EduStack IS project and points to the running application instances. The DNS zone `is-edustack.org` is the same zone used for the per-environment subdomains (`sandbox-*` for the frontend on Cloudflare Pages, `be-sandbox-*` for the backend on Fly.io) created by the deployment workflow described below.

## Live sandboxes

The table below is maintained automatically by the **Deploy Environment** workflow — each successful `deploy` adds or refreshes a row and each `delete` removes one.

<!-- DEPLOYED_ENVS_START -->

| Env       | Frontend                          | Backend                              | MailDev                                | Last deployed        |
| --------- | --------------------------------- | ------------------------------------ | -------------------------------------- | -------------------- |
| sandbox-1 | https://sandbox-1.is-edustack.org | https://be-sandbox-1.is-edustack.org | https://mail-sandbox-1.is-edustack.org | 2026-05-16 19:23 UTC |

<!-- DEPLOYED_ENVS_END -->

## Technology

| Layer      | Stack                                               |
| ---------- | --------------------------------------------------- |
| Backend    | NestJS, better-sqlite3                              |
| Database   | SQLite (file on a Fly.io persistent volume)         |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| MCP Server | Node.js, Express, SSE transport, 36 AI tools        |
| AI         | Google Gemini (configurable – OpenAI, Anthropic)    |
| Infra      | Fly.io (backend + MCP), Cloudflare Pages (frontend) |

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- For deploying: a Fly.io account (`flyctl auth signup`) and a Cloudflare account with the `is-edustack.org` zone added

### 1. Configuration

The application uses a single shared environment file in the project root.

```bash
cp .env.example .env
```

| Variable              | Description                                  | How to generate           |
| --------------------- | -------------------------------------------- | ------------------------- |
| `JWT_SECRET`          | Key used to sign JWT tokens                  | `openssl rand -base64 64` |
| `ENCRYPTION_KEY`      | AES-256 key for encrypting secrets           | `openssl rand -base64 32` |
| `ENABLE_LOGIN_HELPER` | Shows a demo-users panel on the login screen | `true` or `false`         |

**SMTP (emails):**
For local email testing, MailDev starts automatically with the application:

- **SMTP server:** port 1025
- **Web UI:** http://localhost:1081 (inspect delivered messages)

### 2. Install and prepare the database

```bash
# 1. Install dependencies
npm install

# 2. Initialize the local SQLite database
npm run db:init
```

#### Working with the database

| Action           | Command           | Description                             |
| :--------------- | :---------------- | :-------------------------------------- |
| **Reset / Init** | `npm run db:init` | Creates/updates the local SQLite schema |
| **Browse**       | `npm run db:view` | Opens a SQLite browser (e.g. DBeaver)   |

In deployed environments the SQLite file lives on the Fly volume at `/data/edustack.db` and is initialised automatically from `apps/backend/src/database/schema.sql` on first boot.

### 3. Demo data

The system can auto-seed demo data at startup when `AUTO_SEED=true` is set in `.env`.

**Default credentials (if seed data is loaded):**

- System administrator: `admin@edustack.cz`
- Headmaster: `headmaster@tgmasaryk.cz`

### 4. Run the application

```bash
# Starts backend, frontend and MCP server together
npm run dev
```

| Service      | URL                            |
| ------------ | ------------------------------ |
| Application  | http://localhost:5173          |
| Backend API  | http://localhost:3000          |
| Swagger docs | http://localhost:3000/api/docs |

## Backup storage

The system supports both automatic and manual database backups. Storage is configurable:

### 1. Local mode (default)

If the `R2_*` variables in `.env` are left empty, backups are written to `data/backups`.

### 2. Production mode (Cloudflare R2)

For secure cloud storage, configure the R2 bucket credentials:

- **R2_ENDPOINT:** URL of your R2 endpoint (found in the Cloudflare dashboard).
- **R2_ACCESS_KEY_ID:** Access key with write permission.
- **R2_SECRET_ACCESS_KEY:** Secret key (set as a Fly secret in production: `flyctl secrets set R2_SECRET_ACCESS_KEY=… --app edustack-sandbox-N`).

**Note:** Do not use random values for local development (they will cause connection errors). If you do not have R2 keys, leave the fields empty to fall back to local mode.

## Deployment

The `.github/workflows/deploy-env.yml` GitHub Actions workflow provisions an isolated environment per `env_id`:

- **Backend + MCP server**: one Fly.io app per env (`edustack-sandbox-N`) running both Node processes in a single container, with a 1 GB persistent volume mounted at `/data` for the SQLite database. MCP listens on `127.0.0.1:3001` inside the container; only the backend can reach it.
- **Frontend**: one Cloudflare Pages project per env (`edustack-frontend-sandbox-N`), built from `apps/frontend` with `VITE_API_URL` pointed at the matching backend.
- **Custom domains** under `is-edustack.org`:
    - `sandbox-N.is-edustack.org` → Cloudflare Pages
    - `be-sandbox-N.is-edustack.org` → Fly.io (CNAME to `edustack-sandbox-N.fly.dev`, TLS via Fly Let's Encrypt)

### 1. GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions → New repository secret**.

**Required:**

| Secret                  | What it is                                             | Where to get it                                                       |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `FLY_API_TOKEN`         | Fly.io API token (account-wide, so it can create apps) | `flyctl auth login`, then `flyctl auth token`                         |
| `CLOUDFLARE_API_TOKEN`  | API token for Pages deploys + DNS edits                | Cloudflare → My Profile → API Tokens → Create Token                   |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                             | Cloudflare dashboard → right sidebar on any Workers / domain overview |

**Recommended (the workflow has weak fallbacks if these are missing):**

| Secret           | What it is                                             |
| ---------------- | ------------------------------------------------------ |
| `JWT_SECRET`     | ≥32-character random string used for signing JWTs      |
| `ENCRYPTION_KEY` | Exactly 32 hex characters (AES-256 key)                |
| `MCP_AUTH_TOKEN` | Shared bearer token between the backend and MCP server |

Generate them locally:

```bash
openssl rand -hex 32   # JWT_SECRET / MCP_AUTH_TOKEN
openssl rand -hex 16   # ENCRYPTION_KEY (32 hex chars)
```

These three values are pushed into Fly with `flyctl secrets set` on every deploy of each env. If you ever rotate them manually in the Fly dashboard, the next workflow run will overwrite them with the GitHub-secret values.

### 2. Cloudflare API token permissions

Create a **Custom token** with these permissions:

- Account → **Cloudflare Pages** → Edit
- Account → **Account Settings** → Read
- Zone → **Zone** → Read (scoped to `is-edustack.org`)
- Zone → **DNS** → Edit (scoped to `is-edustack.org`)
- User → **User Details** → Read

### 3. One-time prerequisites

1. **Cloudflare:** add the zone `is-edustack.org` (Websites → Add a site) and point your registrar's nameservers to Cloudflare.
2. **Fly.io:** create an account (`flyctl auth signup`) and confirm your org slug is `personal` (default for personal accounts). If you've created a custom org, update `FLY_ORG` in `.github/workflows/deploy-env.yml`.

### 4. Running the workflow

**GitHub → Actions → Deploy Environment → Run workflow**, pick an `env_id` (e.g. `1`) and one of two actions:

| Action     | What it does                                                                                                                    | When to use                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **deploy** | Full provision: create Fly app + volume (idempotent), stage secrets, `flyctl deploy`, attach DNS + TLS, build + deploy frontend | First time and any subsequent push — every step is idempotent |
| **delete** | Destroys the Fly app (machines + volume), removes the CNAMEs, deletes the Pages project                                         | Tearing an environment down                                   |

After a successful `deploy`, the run summary lists the live URLs (`sandbox-N`, `be-sandbox-N`) and the Fly app name.

### 5. Costs

Each environment is one Fly.io machine (`shared-cpu-1x`, 512 MB) that auto-stops when idle, plus a 1 GB volume. Fly.io offers a 7-day trial; afterwards a payment method is required for the pay-as-you-go plan (the old always-free Hobby tier no longer exists). The 1 GB volume (~$0.15/month) accrues even while the machine is stopped — to drop to zero between demos, `delete` the env and `deploy` it again later. Realistic cost at demo / low-traffic usage is roughly **$1–2 per environment per month**. The Cloudflare Pages side stays on the free tier comfortably.

## Documentation

- [Functional analysis](docs/funkcni-analyza.md) – overview of 169 features with current implementation status.
