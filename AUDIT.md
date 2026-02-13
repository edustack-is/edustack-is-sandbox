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

## Task 1.8: Inicializační Modul (InitModule)
- **Popis**: Implementace modulu pro inicializaci aplikace.
  - `InitService`: Metody `getStatus` a `setup`. Setup probíhá v transakci (vytvoření školy + admina).
  - `InitController`: Public endpointy `GET /api/init/status` a `POST /api/init/setup`.
  - Registrace v `AppModule`.
- **Soubory**:
  - `apps/backend/src/init/*`
  - `apps/backend/src/app.module.ts`
- **Commit**: `Task 1.8: Initialization Module`

## Task 1.9 & 1.10: JWT Auth & Guards
- **Popis**: Implementace JWT autentizace a autorizace.
  - `JwtStrategy`: Strategie pro validaci JWT.
  - `JwtAuthGuard`: Globální guard (vyžaduje token).
  - `RolesGuard`: Globální guard pro kontrolu rolí (`@Roles`).
  - Dekorátor `@Public`: Pro public endpointy (login, init).
  - AuthController: `POST /login`.
- **Soubory**:
  - `apps/backend/package.json`
  - `apps/backend/src/auth/*`
  - `apps/backend/src/app.module.ts`
- **Commit**: `Task 1.9 & 1.10: JWT Authentication & Guards`

## Phase 2: Frontend Wizard & Auth (Tasks 2.1 - 2.4)
- **Popis**: Implementace frontendového průvodce a přihlašování.
  - Vytvořeny stránky `Setup.tsx` (inicializace aplikace) a `Login.tsx`.
  - Implementována logika v `App.tsx` pro kontrolu stavu inicializace a přesměrování.
  - Přidány metody do API klienta.
  - Ošetření chybových stavů při načítání.
- **Soubory**:
  - `apps/frontend/src/api/index.ts`
  - `apps/frontend/src/pages/Setup.tsx`
  - `apps/frontend/src/pages/Login.tsx`
  - `apps/frontend/src/App.tsx`
  - `apps/frontend/src/components/layout/Layout.tsx`
  - `apps/frontend/vite.config.ts`
- **Commit**: `Phase 2: Frontend Wizard & Auth`

## Task 4.3 & 4.4: Frontend Infrastructure (Tailwind CSS & Shadcn/ui)
- **Popis**: Nastavení stylování a UI komponent.
  - Instalace Tailwind CSS, PostCSS, Autoprefixer.
  - Konfigurace `tailwind.config.js` a `postcss.config.js`.
  - Inicializace `shadcn/ui` a instalace základních komponent (Button, Card, Input, Label, Form, Dialog).
  - Konfigurace aliasů `@/*` v `tsconfig.app.json` a `vite.config.ts`.
- **Soubory**:
  - `apps/frontend/package.json`
  - `apps/frontend/tailwind.config.js`
  - `apps/frontend/postcss.config.js`
  - `apps/frontend/src/index.css`
  - `apps/frontend/components.json`
  - `apps/frontend/src/lib/utils.ts`
  - `apps/frontend/src/components/ui/*`
- **Commit**: `Task 4.3 & 4.4: Frontend Infrastructure (Tailwind CSS & Shadcn/ui)`

## Task 4.5: Main Layout & Dashboard
- **Popis**: Implementace hlavního layoutu a dashboardu.
  - `MainLayout`: Responzivní layout s postranním panelem.
  - `Sidebar`: Navigace (Nástěnka, Uživatelé, Rozvrh, Klasifikace, AI Tutor).
  - `Dashboard`: Úvodní stránka s přehledovými kartami.
  - `App.tsx`: Routing pro `/dashboard`.
  - Fix: Přidání proxy pro `/auth` do `vite.config.ts`.
- **Soubory**:
  - `apps/frontend/src/components/layout/MainLayout.tsx`
  - `apps/frontend/src/components/layout/Sidebar.tsx`
  - `apps/frontend/src/pages/Dashboard.tsx`
  - `apps/frontend/src/App.tsx`
  - `apps/frontend/vite.config.ts`
- **Commit**: `Task 4.5: Main Layout, Sidebar & Dashboard`

## Fix: AI Seeder UserRole
- **Popis**: Oprava používání `UserRole` enumu v `AiService` a vyplňování `firstName`/`lastName` v tabulce User.
- **Soubory**:
  - `apps/backend/src/ai/ai.service.ts`
## Phase 5: Audit & Security Logging (Tasks 5.1 - 5.4)
- **Popis**: Implementace komplexního auditování a oprava routování.
  - **Schema**: Rozšíření `AuditLog` modelu (akce, entita, old/newValues, IP, UserAgent).
  - **Middleware**: Automatické logování CREATE/UPDATE/DELETE operací v `PrismaService` pomocí `$extends`. Implementace Data Scrubbing (odstranění hesel).
  - **Auth Audit**: Logování úspěšných i neúspěšných přihlášení (`LOGIN`, `LOGIN_FAILED`) včetně IP a UA.
  - **Sensitive Read**: Dekorátor `@LogSensitiveRead` a Interceptor pro logování přístupu k citlivým datům (`READ_SENSITIVE`).
  - **Routing Fix**: Přejmenování backend controllerů na `/api/*` pro vyřešení konfliktu s frontend routingem (`/users` vs `/api/users`).
- **Soubory**:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/src/prisma/prisma.service.ts`
  - `apps/backend/src/auth/auth.service.ts`
  - `apps/backend/src/auth/auth.controller.ts`
  - `apps/backend/src/auth/log-sensitive-read.*`
  - `apps/backend/src/users/users.controller.ts`
  - `apps/backend/src/registry/registry.controller.ts`
  - `apps/frontend/src/api/index.ts`
  - `apps/frontend/vite.config.ts`
## Phase 6: User Profile & Logout
- **Popis**: Implementace zobrazení profilu přihlášeného uživatele a odhlášení.
  - **Backend**: Endpoint `GET /api/auth/me` (guarded) vrací detail uživatele.
  - **Frontend**:
    - API metoda `getMe`.
    - `Sidebar`: Zobrazení avatara, jména, emailu a role.
    - `Sidebar`: Tlačítko "Odhlásit se" (clear token + redirect).
    - Fix: Instalace chybějících komponent `avatar` a `badge` (shadcn) do správného adresáře.
- **Soubory**:
  - `apps/backend/src/auth/auth.controller.ts`
  - `apps/backend/src/auth/auth.service.ts`
  - `apps/frontend/src/api/index.ts`
  - `apps/frontend/src/components/layout/Sidebar.tsx`
  - `apps/frontend/src/components/ui/avatar.tsx`
  - `apps/frontend/src/components/ui/badge.tsx`
- **Commit**: `Phase 6: User Profile, Logout & UI Components`

## Task 8.8: System Admin UI - Multi-Provider Settings
- **Popis**: Implementace správy API klíčů pro více AI providerů.
  - Backend: Update `SystemAdminAiService` (šifrování klíčů, usage stats per provider).
  - Backend: Update `PUT /api/system/settings/ai` (validator).
  - Frontend: Formulář pro zadání klíčů (Gemini, OpenAI, Anthropic).
  - Frontend: Grafy spotřeby tokenů podle providera.
- **Soubory**:
  - `apps/backend/src/system-admin/system-admin-ai.*`
  - `apps/frontend/src/pages/SystemAdminAi.tsx`
- **Commit**: `feat: System Admin UI - Multi-Provider Settings`

## Task 8.9: AI Chat UI - Provider Selection
- **Popis**: Implementace výběru AI modelu přímo v chatu.
  - Backend: Endpoint `GET /api/ai/providers` (vrací dostupné modely).
  - Frontend: Dropdown `Select` v hlavičce chatu.
  - Frontend: Ukládání volby a odesílání `provider` ID v payloadu.
- **Soubory**:
  - `apps/backend/src/ai/ai.controller.ts`
  - `apps/backend/src/ai/ai-chat.service.ts`
  - `apps/frontend/src/api/ai.ts`
  - `apps/frontend/src/components/AiChatDrawer.tsx`
- **Commit**: `feat: AI Chat Provider Selection (Task 8.9)`
