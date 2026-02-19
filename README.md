# EduStack IS

Školní informační systém pro základní a střední školy. Monorepo s backendem (NestJS), frontendem (React) a MCP serverem pro AI agenty.

## Technologie

| Vrstva | Stack |
|--------|-------|
| Backend | NestJS, Prisma ORM, PostgreSQL |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| MCP Server | Node.js, SSE transport, 36 AI nástrojů |
| AI | Google Gemini (konfigurovatelné – OpenAI, Anthropic) |
| Infra | Docker Compose, PWA, automatické zálohy |

## Rychlý start

### Prerekvizity

- Docker & Docker Compose
- Node.js 20+ (pro frontend dev server)

### 1. Konfigurace

```bash
cp .env.example .env
```

Povinné proměnné v `.env`:

| Proměnná | Popis | Jak vygenerovat |
|----------|-------|-----------------|
| `JWT_SECRET` | Klíč pro podepisování JWT tokenů | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | AES-256 klíč pro šifrování secrets | `openssl rand -base64 32` |

Vše ostatní má rozumné výchozí hodnoty pro lokální vývoj (databáze, SMTP, CORS).

### 2. Spuštění backendu

```bash
docker compose up -d
```

Při prvním spuštění se automaticky:
- nainstalují závislosti (`npm install`)
- vygeneruje Prisma klient
- vytvoří/aktualizuje schéma databáze

| Služba | URL |
|--------|-----|
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api/docs |
| MCP Server | http://localhost:3001/sse |
| MailDev (dev e-maily) | http://localhost:1080 |

Pro Adminer (DB GUI): `docker compose --profile dev up -d`  → http://localhost:8080

### 3. Spuštění frontendu

```bash
cd apps/frontend
npm install
npm run dev
```

Aplikace: http://localhost:5173

### 4. Prvotní nastavení

Po spuštění otevřete http://localhost:5173 — zobrazí se Setup průvodce pro vytvoření prvního systémového administrátora.

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

## Dokumentace

- [Funkční analýza](docs/funkcni-analyza.md) – přehled 169 funkcí s aktuálním stavem implementace
