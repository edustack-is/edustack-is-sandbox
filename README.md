# EduStack IS

Školní informační systém pro základní a střední školy. Monorepo s backendem (NestJS), frontendem (React) a MCP serverem pro AI agenty.

## Technologie

| Vrstva     | Stack                                                |
| ---------- | ---------------------------------------------------- |
| Backend    | NestJS, Custom SQLite/D1 service (better-sqlite3)    |
| Databáze   | Cloudflare D1 (SQLite)                               |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui  |
| MCP Server | Node.js, SSE transport, 36 AI nástrojů               |
| AI         | Google Gemini (konfigurovatelné – OpenAI, Anthropic) |
| Infra      | Cloudflare Workers, Cloudflare Pages                 |

## Rychlý start

### Prerekvizity

- Node.js 20+
- npm 10+
- Cloudflare Wrangler (`npm install -g wrangler`)

### 1. Konfigurace

Aplikace používá jeden společný soubor s proměnnými prostředí v kořenu projektu.

```bash
cp .env.example .env
```

| Proměnná              | Popis                                         | Jak vygenerovat           |
| --------------------- | --------------------------------------------- | ------------------------- |
| `JWT_SECRET`          | Klíč pro podepisování JWT tokenů              | `openssl rand -base64 64` |
| `ENCRYPTION_KEY`      | AES-256 klíč pro šifrování secrets            | `openssl rand -base64 32` |
| `ENABLE_LOGIN_HELPER` | Zapne panel s demo uživateli na login screenu | `true` nebo `false`       |

**SMTP (E-maily):**
Pro lokální testování e-mailů se při spuštění aplikace automaticky aktivuje MailDev:

- **SMTP server:** Port 1025
- **Webové rozhraní:** http://localhost:1081 (konzultace doručených e-mailů)

### 2. Instalace a příprava databáze

Aplikace je plně integrovaná s **Cloudflare D1**. Pro lokální vývoj i produkci používáme stejný Wrangler workflow.

```bash
# 1. Instalace závislostí
npm install

# 2. Inicializace lokální D1 databáze (vytvoří schéma přes Wrangler)
npm run db:init
```

#### Práce s databází

| Akce             | Příkaz              | Popis                                       |
| :--------------- | :------------------ | :------------------------------------------ |
| **Reset / Init** | `npm run db:init`   | Vytvoří/aktualizuje lokální D1 schéma       |
| **Deploy**       | `npm run db:deploy` | Přenese změny schématu do Cloudflare Cloudu |
| **Prohlížení**   | `npm run db:view`   | Otevře SQLite prohlížeč (např. DBeaver)     |

### 3. Demo Data

Systém podporuje automatické naplnění daty při startu, pokud je v `.env` nastavena proměnná `AUTO_SEED=true`.

**Výchozí přihlašovací údaje (pokud jsou data načtena):**

- Systémový administrátor: `admin@edustack.cz`
- Ředitel: `headmaster@tgmasaryk.cz`

### 4. Spuštění aplikace

```bash
# Spustí backend, frontend a MCP server najednou
npm run dev
```

| Služba       | URL                            |
| ------------ | ------------------------------ |
| Aplikace     | http://localhost:5173          |
| Backend API  | http://localhost:3000          |
| Swagger docs | http://localhost:3000/api/docs |

## Zálohování (Backup Storage)

Systém podporuje automatické i manuální zálohy databáze. Úložiště je konfigurovatelné:

### 1. Lokální režim (Výchozí)

Pokud ponecháte proměnné `R2_*` v `.env` prázdné, zálohy se budou ukládat do adresáře `data/backups`.

### 2. Produkční režim (Cloudflare R2)

Pro bezpečné uložení v cloudu nastavte přihlašovací údaje k R2 bucketu:

- **R2_ENDPOINT:** URL vašeho R2 rozhraní (najdete v CF dashboardu).
- **R2_ACCESS_KEY_ID:** Přístupový klíč s právy pro zápis.
- **R2_SECRET_ACCESS_KEY:** Tajný klíč (v produkci vložte jako `wrangler secret`).

**Upozornění:** Pro lokální vývoj nepoužívejte náhodné hodnoty (způsobí chybu spojení). Pokud nemáte R2 klíče, nechte pole prázdná pro aktivaci lokálního režimu.

## Dokumentace

- [Funkční analýza](docs/funkcni-analyza.md) – přehled 169 funkcí s aktuálním stavem implementace.
- [Cloudflare Guide](README_CLOUDFLARE.md) – podrobnější info k nasazení.
