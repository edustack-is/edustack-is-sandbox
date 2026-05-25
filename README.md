# EduStack IS

School information system for primary and secondary schools. Monorepo with a backend (NestJS), frontend (React) and an MCP server for AI agents.

## Info website

A public information website is already deployed at **https://is-edustack.org/**. It serves as the landing/marketing page for the EduStack IS project and points to the running application instances. The DNS zone `is-edustack.org` is the same zone used for the per-environment subdomains (`sandbox-*` for the frontend on Cloudflare Pages, `be-sandbox-*` for the backend on Fly.io) created by the deployment workflow described below.

## Live sandboxes

The table below is maintained automatically by the **Deploy Environment** workflow — each successful `deploy` adds or refreshes a row and each `delete` removes one.

<!-- DEPLOYED_ENVS_START -->

| Env       | Frontend                          | Backend                              | MailDev                                | Last deployed        |
| --------- | --------------------------------- | ------------------------------------ | -------------------------------------- | -------------------- |
| sandbox-1 | https://sandbox-1.is-edustack.org | https://be-sandbox-1.is-edustack.org | https://mail-sandbox-1.is-edustack.org | 2026-05-25 19:59 UTC |
| sandbox-2 | https://sandbox-2.is-edustack.org | https://be-sandbox-2.is-edustack.org | https://mail-sandbox-2.is-edustack.org | 2026-05-17 21:01 UTC |
| sandbox-3 | https://sandbox-3.is-edustack.org | https://be-sandbox-3.is-edustack.org | https://mail-sandbox-3.is-edustack.org | 2026-05-17 16:24 UTC |
| sandbox-4 | https://sandbox-4.is-edustack.org | https://be-sandbox-4.is-edustack.org | https://mail-sandbox-4.is-edustack.org | 2026-05-25 19:59 UTC |

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

| Variable              | Description                                                                                       | How to generate                 |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| `JWT_SECRET`          | Key used to sign JWT tokens                                                                       | `openssl rand -base64 64`       |
| `ENCRYPTION_KEY`      | AES-256 key for encrypting secrets                                                                | `openssl rand -base64 32`       |
| `ENABLE_LOGIN_HELPER` | Shows a demo-users panel on the login screen                                                      | `true` or `false`               |
| `ADMINER_PASSWORD`    | Enables the Adminer DB viewer + seeds its permanent-login cookie (Adminer itself is passwordless) | any string (default `edustack`) |

**SMTP (emails):**
For local email testing, MailDev starts automatically with the application:

- **SMTP server:** port 1025
- **Web UI:** http://localhost:1081 (inspect delivered messages)

**Database viewer (Adminer):**
For inspecting the SQLite schema and data, Adminer starts automatically with `npm run dev` (needs either `php` or `docker` available):

- **Web UI:** http://localhost:8080 — the connection is **prefilled** (SQLite, pointed at the local DB file) and **passwordless**; the page auto-submits straight into the database. This is an educational sandbox, so no credentials are required.

The Adminer binary, plugins and designs are third-party files fetched (not vendored) by `adminer/fetch-assets.sh` on first run. Bundled plugins: `table-structure` + `table-indexes-structure` (expanded schema/index info), `tables-filter` (filter the tables list), `designs` (theme switcher, bottom-right). The default view style is **Konya** (pinned to the v5.4.2 CSS); **Dracula** (dark) is also offered in the switcher. (The standalone `dark-switcher` plugin needs Adminer 5.x, so dark mode is provided via the dark design instead.)

On deployed sandboxes Adminer rides along inside the backend container (SQLite is a file on the backend's volume, so it can't be a standalone app like MailDev) and is published at **`https://be-<env>.is-edustack.org:8443`**. The login screen's helper panel and the System Monitoring tab link straight to it. **Note:** Adminer is passwordless and publicly reachable — anyone with the link has full read/write access to that sandbox's database. Fine for throwaway educational sandboxes; don't put sensitive data in them.

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

**Conditional — R2 backup storage:**

If both of these are set, the deploy workflow creates a per-env R2 bucket (`edustack-sandbox-N-backups`) for backups; admin-page "Create backup" then writes to R2 instead of the Fly volume. Without them, the workflow logs `R2 backup storage: not configured (backups will land on container volume)` and skips the R2 step — deploy still succeeds.

| Secret                 | What it is                             | Where to get it                                                                                |
| ---------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `R2_ACCESS_KEY_ID`     | S3-compatible access key ID for R2     | Cloudflare → R2 Object Storage → right sidebar → API Tokens → Manage → **Create R2 API Token** |
| `R2_SECRET_ACCESS_KEY` | S3-compatible secret access key for R2 | Same dialog as above — copy the **Secret Access Key** once (Cloudflare won't show it again)    |

The R2 token needs **Object Read & Write** permission, scoped to **All buckets** (one set of keys serves every per-env bucket the workflow creates). The bucket itself is created by the workflow — you don't need to pre-create it. `R2_ENDPOINT` and `R2_BUCKET_NAME` are derived from `CLOUDFLARE_ACCOUNT_ID` and the env name, so they aren't separate secrets.

### 2. Cloudflare API token permissions

Create a **Custom token** with these permissions:

- Account → **Cloudflare Pages** → Edit
- Account → **Account Settings** → Read
- Account → **Workers R2 Storage** → Edit _(only needed if you're using R2-backed backups)_
- Zone → **Zone** → Read (scoped to `is-edustack.org`)
- Zone → **DNS** → Edit (scoped to `is-edustack.org`)
- User → **User Details** → Read

### 3. One-time prerequisites

1. **Cloudflare:** add the zone `is-edustack.org` (Websites → Add a site) and point your registrar's nameservers to Cloudflare.
2. **Fly.io:** create an account (`flyctl auth signup`) and confirm your org slug is `personal` (default for personal accounts). If you've created a custom org, update `FLY_ORG` in `.github/workflows/deploy-env.yml`.

### 4. Integrations configured after deploy (not GitHub secrets)

These live in the database (encrypted via `ENCRYPTION_KEY`) and are managed through the system-admin UI after the env is up. They're optional — the app boots without them, but the listed features won't work until they're set.

| Integration             | Where to configure                                         | What it enables                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Google OAuth client** | System admin → Settings → SSO → Google                     | "Sign in with Google" + "Link Google account". Add `https://be-sandbox-N.is-edustack.org/api/auth/callback/google` to the OAuth client's Authorized redirect URIs in Google Cloud Console. |
| **GitHub / Microsoft**  | System admin → Settings → SSO → respective provider        | Same flow, same callback URL pattern (`/api/auth/callback/<provider>`).                                                                                                                    |
| **AI provider key**     | System admin → Settings → AI → Google / OpenAI / Anthropic | Thematic plans, grade-polish, written tests, school-name AI generator.                                                                                                                     |

### 5. Running the workflow

**GitHub → Actions → Deploy Environment → Run workflow**, pick an `env_id` (e.g. `1`) and one of two actions:

| Action     | What it does                                                                                                                    | When to use                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **deploy** | Full provision: create Fly app + volume (idempotent), stage secrets, `flyctl deploy`, attach DNS + TLS, build + deploy frontend | First time and any subsequent push — every step is idempotent |
| **delete** | Destroys the Fly app (machines + volume), removes the CNAMEs, deletes the Pages project                                         | Tearing an environment down                                   |

After a successful `deploy`, the run summary lists the live URLs (`sandbox-N`, `be-sandbox-N`) and the Fly app name.

### 6. Costs

Each environment is one Fly.io machine (`shared-cpu-1x`, 512 MB) that auto-stops when idle, plus a 1 GB volume. Fly.io offers a 7-day trial; afterwards a payment method is required for the pay-as-you-go plan (the old always-free Hobby tier no longer exists). The 1 GB volume (~$0.15/month) accrues even while the machine is stopped — to drop to zero between demos, `delete` the env and `deploy` it again later. Realistic cost at demo / low-traffic usage is roughly **$1–2 per environment per month**. The Cloudflare Pages side stays on the free tier comfortably.

## Documentation

- [Functional analysis](docs/funkcni-analyza.md) – overview of 169 features with current implementation status.
