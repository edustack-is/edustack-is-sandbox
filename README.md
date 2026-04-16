# EduStack IS

Školní informační systém pro základní a střední školy. Monorepo s backendem (NestJS), frontendem (React) a MCP serverem pro AI agenty.

## Technologie

| Vrstva | Stack |
|--------|-------|
| Backend | NestJS, Prisma ORM |
| Databáze | Cloudflare D1 (SQLite) |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| MCP Server | Node.js, SSE transport, 36 AI nástrojů |
| AI | Google Gemini (konfigurovatelné – OpenAI, Anthropic) |
| Infra | Cloudflare Workers, Cloudflare Pages |

## Rychlý start

### Prerekvizity

- Node.js 20+
- npm 10+
- Cloudflare Wrangler (`npm install -g wrangler`)

### 1. Konfigurace

Zkopírujte vzor pro lokální vývoj:

```bash
cp .env.example .env
```

| Proměnná | Popis | Jak vygenerovat |
|----------|-------|-----------------|
| `JWT_SECRET` | Klíč pro podepisování JWT tokenů | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | AES-256 klíč pro šifrování secrets | `openssl rand -base64 32` |

**SMTP (E-maily):**
Pro lokální testování e-mailů (zapomenuté heslo, pozvánky) spusťte MailDev:
- `npx maildev` (webové rozhraní na http://localhost:1080)

### 2. Instalace a příprava databáze

Aplikace je plně integrovaná s **Cloudflare D1**. Pro lokální vývoj i produkci používáme stejný Wrangler workflow.

```bash
# 1. Instalace závislostí
npm install

# 2. Vygenerování Prisma klienta (pro TypeScript typy)
npm run db:generate

# 3. Inicializace lokální D1 databáze (vytvoří schéma přes Wrangler)
npm run db:init
```

#### Práce s databází

| Akce | Příkaz | Popis |
| :--- | :--- | :--- |
| **Reset / Init** | `npm run db:init` | Vytvoří/aktualizuje lokální D1 schéma |
| **Deploy** | `npm run db:deploy` | Přenese změny schématu do Cloudflare Cloudu |
| **Prohlížení** | `npm run db:studio` | Otevře grafické rozhraní Prisma Studio |

### 3. Demo Data

Chcete-li databázi naplnit kompletním školním nastavením (akademické roky, školy, uživatelé, třídy atd.), spusťte:

```bash
npm run seed:demo
```

**Přihlašovací údaje (Heslo: `password123`):**
- Systémový administrátor: `admin@edustack.cz`
- Ředitel: `headmaster@tgmasaryk.cz`

### 4. Spuštění aplikace

```bash
# Spustí backend, frontend a MCP server najednou
npm run dev
```

| Služba | URL |
|--------|-----|
| Aplikace | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api/docs |

## Dokumentace

- [Funkční analýza](docs/funkcni-analyza.md) – přehled 169 funkcí s aktuálním stavem implementace.
- [Cloudflare Guide](README_CLOUDFLARE.md) – podrobnější info k nasazení.
