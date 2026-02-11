# Audit Log

## Task 0.1: Struktura Monorepa a Git
- **Popis**: Inicializace repozitáře, vytvoření adresářové struktury (apps/backend, apps/frontend, packages/shared).
- **Soubory**: 
  - `package.json` (root workspaces)
  - `.gitignore`
  - `README.md`
- **Commit**: `Task 0.1: Struktura Monorepa a Git`

## Task 0.2: Docker Compose Infrastruktura
- **Popis**: Nastavení Docker prostředí s PostgreSQ a Adminerem.
- **Soubory**:
  - `docker-compose.yml`
  - `.env.example`
- **Commit**: `Task 0.2: Docker Compose Infrastruktura`

## Task 0.3: Inicializace Backend (NestJS)
- **Popis**: Založení NestJS projektu v `apps/backend`. Nastavení portu 3000, @nestjs/config a docker služby.
- **Soubory**:
  - `apps/backend/*` (zdrojový kód NestJS)
  - `apps/backend/package.json`
- **Commit**: `Task 0.3: Inicializace Backend (NestJS)`

## Task 0.4: Databáze a Prisma ORM Setup
- **Popis**: Integrace Prisma ORM, nastavení databázového připojení a vytvoření modelu SystemLog.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/.env`
- **Commit**: `Task 0.4: Databáze a Prisma ORM Setup`
