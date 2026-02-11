# Edu Stack Sandbox

Vzdělávací projekt demonstrující architekturu moderního školního informačního systému. Projekt je realizován jako monorepo obsahující backend (NestJS) a frontend (React).

## 🚀 Technologie

- **Backend**: NestJS, Prisma ORM, PostgreSQL
- **Frontend**: React, Vite, TypeScript, Tailwind/CSS variables
- **Databáze**: PostgreSQL (běží v Dockeru)
- **AI**: Google Gemini Pro (generování dat)
- **Nástroje**: Docker Compose, NPM Workspaces

## 📦 Moduly

Projekt je rozdělen do několika funkčních celků:

### 1. Core Modules
- **Users**: Správa uživatelů, rolí (Student, Učitel, Admin) a autentizace.
- **Registry (Matrika)**: Evidence tříd (`Classroom`) a profilů studentů/učitelů.

### 2. Education Modules
- **Grading (Klasifikace)**: Správa předmětů a známek. Výpočet váženého průměru.
- **Schedule (Rozvrh)**: Správa rozvrhových akcí a automatická kontrola kolizí (učitel/místnost).

### 3. AI Integrace
- **Data Seeder**: Využití Google Generative AI pro generování realistických testovacích dat (studenti, jména).

## 🛠 Instalace a Spuštění

### Prerekvizity
- Docker & Docker Compose
- Node.js (v20+)
- Google AI API Key (pro funkcionalitu generování dat)

### 1. Příprava prostředí

V kořenovém adresáři vytvořte soubor `.env` (zkopírujte `.env.example`) a doplňte svůj API klíč:

```bash
cp .env.example .env
# Editujte .env a doplňte GOOGLE_AI_API_KEY
```

### 2. Spuštění Backend (Docker)

Backend a databáze běží v kontejnerech. Start backendu automaticky provede:
- Instalaci závislostí
- Generování Prisma klienta
- Migrace databáze

```bash
docker compose up -d
```
- **Backend API**: `http://localhost:3000`
- **Adminer (DB GUI)**: `http://localhost:8080` (Server: `db`, User/Pass/DB: `student`/`student`/`skola_db`)

### 3. Spuštění Frontend (Lokálně)

Frontend spouštíme lokálně pro rychlejší odezvu při vývoji (HMR).

```bash
cd apps/frontend
npm install
npm run dev
```
- **Aplikace**: `http://localhost:5173`

## 🔌 API Endpoints (Ukázka)

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| `GET` | `/users` | Seznam uživatelů |
| `GET` | `/registry/classrooms` | Seznam tříd |
| `POST` | `/api/schedule/validate` | Validace kolizí v rozvrhu |
| `POST` | `/api/ai/seed/:classroomId` | Vygenerování studentů pomocí AI |
| `GET` | `/api/grades/average/:sid/:sub` | Výpočet váženého průměru |

## 📂 Struktura Projektu

```
.
├── apps
│   ├── backend     # NestJS aplikace
│   │   ├── src
│   │   │   ├── ai          # AI Service
│   │   │   ├── grading     # Klasifikace
│   │   │   ├── registry    # Matrika
│   │   │   ├── schedule    # Rozvrh
│   │   │   └── users       # Uživatelé
│   │   └── prisma          # DB Schéma
│   └── frontend    # React aplikace (Vite)
├── packages        # Sdílené knihovny (zatím prázdné)
└── docker-compose.yml
```
