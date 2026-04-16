# EduStack IS

Školní informační systém pro základní a střední školy. Monorepo s backendem (NestJS), frontendem (React) a MCP serverem pro AI agenty.

## Technologie

| Vrstva | Stack |
|--------|-------|
| Backend | NestJS, Prisma ORM, Configurable DB |
| Databáze | PostgreSQL (Docker), SQLite (Local), D1 (Cloudflare) |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| MCP Server | Node.js, SSE transport, 36 AI nástrojů |
| AI | Google Gemini (konfigurovatelné – OpenAI, Anthropic) |
| Infra | PWA, monorepo, automatické zálohy |

## Rychlý start

### Prerekvizity

- Node.js 20+
- npm 10+

### 1. Konfigurace

Zkopírujte vhodný vzor podle toho, jak plánujete aplikaci spouštět:

- **Pro běh v Dockeru:** `cp .env.docker.example .env`
- **Pro lokální běh bez Dockeru (SQLite):** `cp .env.local.example .env`

Povinné proměnné v `.env`:

| Proměnná | Popis | Jak vygenerovat |
|----------|-------|-----------------|
| `JWT_SECRET` | Klíč pro podepisování JWT tokenů | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | AES-256 klíč pro šifrování secrets | `openssl rand -base64 32` |

**SMTP (E-maily):**
Pro lokální testování e-mailů (zapomenuté heslo, pozvánky) máte dvě možnosti:
- **S Dockerem:** `docker-compose up -d maildev` (web na http://localhost:1080)
- **Bez Dockeru:** Spusťte `npx maildev` v samostatném terminálu.

### 2. Instalace a příprava databáze

Aplikace podporuje tři režimy běhu databáze. Vyberte si jeden podle svého prostředí:

#### Možnost A: Lokální vývoj (SQLite / Cloudflare Local)
Ideální pro rychlý start nebo přípravu na Cloudflare.
```bash
# 1. Nastavte v .env
DB_ADAPTER=sqlite
DATABASE_URL="file:./data/dev.db"

# 2. Inicializace (používá SQLite schéma)
npm run db:generate -- --schema=./apps/backend/prisma/schema_sqlite.prisma
npm run db:push -- --schema=./apps/backend/prisma/schema_sqlite.prisma
```

#### Možnost B: Docker (PostgreSQL)
Plnohodnotné prostředí s relační databází.
```bash
# 1. Spuštění Postgresu a MailDevu
docker-compose up -d postgres maildev

# 2. Nastavení v .env (výchozí)
DB_ADAPTER=native
DATABASE_URL="postgresql://student:student@localhost:5432/skola_db"

# 3. Inicializace
npm run db:generate
npm run db:push
```

#### Možnost C: Cloudflare (D1)
Pro nasazení na platformu Cloudflare Workers.
```bash
# 1. Vytvoření D1 databáze
wrangler d1 create edustack_db

# 2. Inicializace schématu (lokálně přes Wrangler)
npx prisma generate --schema=./apps/backend/prisma/schema_sqlite.prisma
wrangler d1 execute edustack_db --local --file=./apps/backend/prisma/schema.sql

# 3. Nasazení do Cloudu
wrangler d1 execute edustack_db --remote --file=./apps/backend/prisma/schema.sql
```

### 3. Demo Data

Chcete-li databázi naplnit kompletním školním nastavením (akademické roky, školy, uživatelé, třídy, absolventi atd.), spusťte:

```bash
npm run seed:demo -w backend
```

Tím se vytvoří:
- **Školy**: Základní škola T. G. Masaryka, Gymnázium Jana Nerudy
- **Roky**: 2024/25 (Minulý), 2025/26 (Současný), 2026/27 (Budoucí)
- **Uživatelé**: Admin, Ředitelé, Učitelé, Studenti, Rodiče, Absolventi

**Přihlašovací údaje (Heslo: `password123`):**
- Systémový administrátor: `admin@edustack.cz`
- Ředitel: `headmaster@tgmasaryk.cz`
- Učitel: `dana.bila@tgmasaryk.cz`
- Absolvent: `alumnus1@tgmasaryk.cz`
- Budoucí student: `future@tgmasaryk.cz`

### 4. Spuštění celé aplikace

V kořenovém adresáři monorepa:

```bash
# Spustí backend, frontend a MCP server najednou (využívá 'concurrently')
npm run dev
```

Tím se spustí paralelně:
- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5173
- **MCP Server**: http://localhost:3001/sse

| Služba | URL |
|--------|-----|
| Aplikace | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api/docs |
| MailDev (web UI) | http://localhost:1080 (pokud běží) |

Pro správu databáze (GUI) můžete použít: `npm run db:studio`

## Struktura projektu

```
├── apps/
│   ├── backend/          # NestJS REST API (17 modulů)
│   ├── frontend/         # React SPA
│   └── mcp-server/       # MCP server pro AI agenty
├── data/                 # Zálohy (gitignored)
├── docs/                 # Dokumentace
│   └── funkcni-analyza.md  # Přehled 169 funkcí (96% pokrytí)
└── docker-compose.yml
```

## Backend moduly

| Modul | Popis |
|-------|-------|
| `auth` | JWT autentizace, SSO (Google/Microsoft), role |
| `init` | Prvotní setup, seed dat |
| `users` | Správa uživatelů |
| `registry` | Matrika – třídy, profily |
| `deputy` | Zástupce ředitele – správa školy |
| `principal` | Ředitel – audit log |
| `grading` | Klasifikace, vysvědčení, chování |
| `schedule` | Rozvrh, suplování, zvonění |
| `attendance` | Docházka |
| `classbook` | Třídní kniha |
| `messaging` | Zprávy, nástěnka, ankety |
| `community` | Školní události, kalendář |
| `ai` | AI chat, generování, moderace |
| `export` | CSV/XML/JSON export dat |
| `reports` | Statistiky prospěchu/docházky, výkazy ČŠI/MŠMT |
| `gdpr` | Export a smazání osobních dat (čl. 15/17 GDPR) |
| `system-admin` | Správa systému, zálohy, monitoring |

## Volitelná konfigurace

Následující nastavení jsou konfigurovatelná přes UI aplikace (System Admin → Nastavení), **není třeba** je nastavovat v `.env`:

- **AI klíče** (Gemini, OpenAI, Anthropic) → System Admin → AI
- **SSO providery** (Google, Microsoft) → System Admin → SSO
- **SMTP** → výchozí MailDev pro dev, produkce přes `.env`
- **Auto zálohy** → `AUTO_BACKUP=true` v `.env` (denně 2:00, retenční politika 7 záloh)

## Testování

Projekt obsahuje automatizované End-to-End (E2E) testy pro všechny své části (Backend, Frontend, MCP Server). Testy zajišťují, že nedojde k nechtěnému rozbití funkčností.

### Backend (NestJS + Prisma)
Backendové testy používají `Supertest` a `Jest` pro ověření API endpointů proti reálné databázi.
```bash
# Z hlavního adresáře projektu:
cd apps/backend

# Spuštění všech E2E testů:
npm run test:e2e
```
*Poznámka: Testy vyžadují běžící PostgreSQL databázi (viz `docker-compose up -d`) a zkopírovaný `.env` soubor podle `.env.example`.*

### Frontend (React + Playwright)
Frontendové testy používají framework `Playwright` pro simulaci uživatele přímo v prohlížečích (Chromium, Firefox, WebKit).
```bash
# Z hlavního adresáře projektu:
cd apps/frontend

# Prvotní instalace prohlížečů pro Playwright (stačí provést jednou):
npx playwright install --with-deps chromium firefox webkit

# Spuštění testů:
npm run test:e2e

# Spuštění testů s UI rozhraním:
npm run test:e2e:ui
```
*Upozornění: E2E testy vyžadují, aby běželo lokální vývojové prostředí i backend API.*

### MCP Server
Pro testování MCP (Model Context Protocol) serveru je použit `Jest` a `@modelcontextprotocol/sdk` nad vlastním SSE transportem.
```bash
# Z hlavního adresáře projektu:
cd apps/mcp-server

# Spuštění integrací a validace nástrojů
npx tsx test/runner.ts
```

## Dokumentace

- [Funkční analýza](docs/funkcni-analyza.md) – přehled 169 funkcí s aktuálním stavem implementace a seznamem pokrývajících testů.
