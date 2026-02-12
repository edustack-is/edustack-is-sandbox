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

## Task 0.5: Rename Project to Edu stack sandbox
- **Popis**: Přejmenování projektu z "Fiktivní IS" na "Edu stack sandbox".
- **Soubory**:
  - `package.json`
  - `README.md`
  - `docker-compose.yml`
- **Commit**: `Task 0.5: Rename Project to Edu stack sandbox`

## Task 1.1: Modul Evidence (Users & Roles) - Identity
- **Popis**: Implementace správy uživatelů a rolí.
  - Přidán model `User` a enum `Role` do schématu.
  - Vytvořen `UsersModule`, `UsersService`, `UsersController`.
  - Implementovány endpointy POST /users a GET /users.
  - Vytvořena migrace `init_users`.
  - Aktualizován `docker-compose.yml` pro automatickou instalaci závislostí.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/src/users/*`
  - `apps/backend/src/prisma/*`
  - `docker-compose.yml`
- **Commit**: `Task 1.1: Modul Evidence (Users & Roles) - Identity`

## Task 1.2: Modul Matrika (Registry) - School Data
- **Popis**: Rozšíření datového modelu o školní matriku.
  - Přidány modely `Classroom`, `StudentProfile`, `TeacherProfile`.
  - Definice vazeb mezi uživateli, profily a třídami.
  - Vytvořen `RegistryModule`, `RegistryService`, `RegistryController`.
  - Aktualizován `UsersService` pro načítání profilů.
  - Migrace `init_registry`.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/src/registry/*`
  - `apps/backend/src/users/users.service.ts`
- **Commit**: `Task 1.2: Modul Matrika (Registry) - School Data`

## Task 2.1: Modul Klasifikace (Grading) - Education
- **Popis**: Implementace klasifikace a výpočtu průměrů.
  - Přidány modely `Subject` a `Grade` do schématu.
  - Vytvořen `GradingModule`, `GradingService`, `GradingController`.
  - Implementován výpočet váženého průměru: `GET /api/grades/average/:studentId/:subjectId`.
  - Migrace `init_grading`.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/src/grading/*`
- **Commit**: `Task 2.1: Modul Klasifikace (Grading) - Education`

## Task 2.2: Modul Rozvrh (Schedule) - Education
- **Popis**: Implementace správy rozvrhu a validace kolizí.
  - Přidán model `ScheduleEvent`.
  - Vytvořen `ScheduleModule`.
  - Implementována validace: `POST /api/schedule/validate` (kontrola kolizí učitele a třídy).
  - Migrace `init_schedule`.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/src/schedule/*`
- **Commit**: `Task 2.2: Modul Rozvrh (Schedule) - Education`

## Task 3.1 & 3.2: AI Integration (Service & Seeder)
- **Popis**: Integrace Google Generative AI pro generování dat.
  - Instalace `@google/generative-ai`.
  - Vytvořen `AiModule`, `AiService`, `AiController`.
  - Implementována metoda `seedClassroom` pro generování fiktivních studentů pomocí AI.
  - Endpoint `POST /api/ai/seed/:classroomId`.
- **Soubory**:
  - `apps/backend/package.json`
  - `apps/backend/src/ai/*`
  - `.env.example`
- **Commit**: `Task 3.1 & 3.2: AI Integration (Service & Seeder)`

## Task 4.1 & 4.2: Frontend (Layout & API)
- **Popis**: Inicializace frontendové aplikace (Vite + React).
  - Vytvořen základní layout se postranním menu (`Sidebar`).
  - Nastaven React Router pro navigaci mezi moduly.
  - Vytvořeny stránky pro jednotlivé moduly (Registry, Grading, Schedule).
  - Konfigurace Vite proxy pro komunikaci s backendem.
  - Implementován API klient (`axios`) a základní funkce pro načítání dat.
- **Soubory**:
  - `apps/frontend/*`
- **Commit**: `Task 4.1 & 4.2: Frontend (Layout & API)`

## Fix: Docker Node.js Version Update
- **Popis**: Změna verze Node.js v `docker-compose.yml` z `18-alpine` na `22-alpine`.
  - Důvod: Prisma v7.4.0 vyžaduje Node.js v20+, což způsobovalo pád backend kontejneru.
- **Soubory**:
  - `docker-compose.yml`

## Task 1.1 - 1.6: Phase 1 Enhanced (Identity & User Management)
- **Popis**: Rozšíření správy identit.
  - Vylepšený User model (status, invitations).
  - Přidány modely Identity (SSO) a AuditLog.
  - Implementován Invitation flow a SSO linking.
  - Implementována Impersonace uživatelů.
  - Frontend: User Management tabulka, CSV Import, Impersonation Banner.
- **Soubory**:
  - `apps/backend/prisma/migrations/20260212185920_advanced_identity_fix/`
  - `apps/backend/src/users/*`
  - `apps/backend/src/auth/auth.service.ts`
  - `apps/backend/src/auth/auth.controller.ts`
  - `apps/frontend/src/pages/Users.tsx`
  - `apps/frontend/src/components/ImpersonationBanner.tsx`
  - `apps/frontend/src/components/layout/Sidebar.tsx`
- **Commit**: `Phase 1 Enhanced: Identity, Invitations, Impersonation`

## Task 1.7: Application Initialization Schema
- **Popis**: Rozšíření schématu o `SchoolConfig` pro uložení globálního nastavení školy a stavu inicializace.
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/prisma/migrations/20260212190229_add_school_config/`
- **Commit**: `Task 1.7: Application Initialization Schema`
