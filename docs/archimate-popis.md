# EduStack IS – Popis ArchiMate modelu

> Specifikace pro zakreslení diagramů v notaci OpenGroup ArchiMate 3.1. Dokument popisuje elementy a vztahy pro business, aplikační a technologickou vrstvu.

---

## Obsah

1. [Business Layer](#1-business-layer)
    - [Business Actors](#11-business-actors)
    - [Business Roles](#12-business-roles)
    - [Business Services](#13-business-services)
    - [Business Processes](#14-business-processes)
2. [Application Layer](#2-application-layer)
    - [Application Components](#21-application-components)
    - [Application Services](#22-application-services)
    - [Application Interfaces](#23-application-interfaces)
    - [Data Objects](#24-data-objects)
3. [Technology Layer](#3-technology-layer)
4. [Vztahy mezi vrstvami (Cross-Layer)](#4-vztahy-mezi-vrstvami)

---

## 1. Business Layer

### 1.1 Business Actors

Fyzické osoby nebo organizace interagující se systémem.

| ID    | Element           | Typ (ArchiMate) | Popis                                                                                                                                       |
| ----- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| BA-01 | Správce systému   | Business Actor  | Globální administrátor celé instance EduStack IS. Spravuje školy, systémové nastavení, SSO a AI konfiguraci. Není vázán na konkrétní školu. |
| BA-02 | Ředitel školy     | Business Actor  | Nejvyšší správce jedné školy. Řídí uživatele, kurikulum, klasifikaci, rozvrh. Má přístup k audit logu.                                      |
| BA-03 | Zástupce ředitele | Business Actor  | Zástupce ředitele s téměř totožnými oprávněními. Nemá přístup k audit logu a v navigaci nemá odkaz na správu uživatelů.                     |
| BA-04 | Učitel            | Business Actor  | Pedagogický pracovník. Zadává známky, docházku, komunikuje se studenty a rodiči. Zobrazuje rozvrh.                                          |
| BA-05 | Student           | Business Actor  | Žák školy. Zobrazuje vlastní rozvrh, známky a průměry. Komunikuje se spolužáky a učiteli.                                                   |
| BA-06 | Rodič             | Business Actor  | Zákonný zástupce studenta. Zobrazuje data propojených dětí (rozvrh, známky). Komunikuje s učiteli.                                          |
| BA-07 | AI agent          | Business Actor  | Externý AI systém přistupující k datům přes MCP protokol.                                                                                   |

### 1.2 Business Roles

Abstraktní role přiřazené aktérům v kontextu školy.

| ID    | Element                 | Typ (ArchiMate) | Přiřazení                         |
| ----- | ----------------------- | --------------- | --------------------------------- |
| BR-01 | Systémový administrátor | Business Role   | BA-01 (Správce systému)           |
| BR-02 | Vedení školy            | Business Role   | BA-02 (Ředitel), BA-03 (Zástupce) |
| BR-03 | Pedagogický pracovník   | Business Role   | BA-04 (Učitel)                    |
| BR-04 | Žák                     | Business Role   | BA-05 (Student)                   |
| BR-05 | Zákonný zástupce        | Business Role   | BA-06 (Rodič)                     |

**Vztahy:** Business Actors jsou přiřazeny k Business Roles vztahem **Assignment**.

### 1.3 Business Services

Služby, které systém poskytuje svým aktérům.

| ID    | Element                     | Typ (ArchiMate)  | Popis                                                | Konzumenti (Serving) |
| ----- | --------------------------- | ---------------- | ---------------------------------------------------- | -------------------- |
| BS-01 | Autentizace a autorizace    | Business Service | Ověření identity, výběr školy a role, vydání tokenu. | Všichni aktéři       |
| BS-02 | Správa systému              | Business Service | Správa škol, syst. adminů, SSO, AI, testovacích dat. | BR-01                |
| BS-03 | Správa školy                | Business Service | Správa tříd, místností, předmětů, uživatelů, audit.  | BR-02                |
| BS-04 | Správa kurikula             | Business Service | Školní roky, semestry, ročníky, ŠVP, zápisy.         | BR-02                |
| BS-05 | Správa rozvrhu              | Business Service | Časové sloty, rozvrhové události, suplování, kolize. | BR-02                |
| BS-06 | Zobrazení rozvrhu           | Business Service | Čtení rozvrhu třídy, učitele nebo studenta.          | Všichni              |
| BS-07 | Klasifikace                 | Business Service | Zadávání, úprava a mazání známek, vysvědčení.        | BR-02, BR-03         |
| BS-08 | Zobrazení klasifikace       | Business Service | Čtení vlastních známek a průměrů.                    | BR-04, BR-05         |
| BS-09 | Evidence docházky           | Business Service | Záznam a sumář docházky.                             | BR-03                |
| BS-10 | Komunikace                  | Business Service | Přímé a hromadné zprávy, notifikace.                 | Všichni              |
| BS-11 | AI asistent                 | Business Service | Konverzační AI, vylepšení slovního hodnocení.        | Všichni              |
| BS-12 | Programatický přístup (MCP) | Business Service | Přístup k datům přes MCP protokol pro AI agenty.     | BA-07                |

**Vztahy:**

- Business Services **realizují** (Realization) Business Processes.
- Business Actors **využívají** Business Services vztahem **Serving**.

### 1.4 Business Processes

#### BP-01: Přihlášení a výběr kontextu

| Krok | Business Process                                                    | Triggering         |
| ---- | ------------------------------------------------------------------- | ------------------ |
| 1    | Zadání přihlašovacích údajů (e-mail/heslo) nebo přesměrování na SSO | Spuštěno aktérem   |
| 2    | Ověření identity                                                    | Navazuje na krok 1 |
| 3    | Vydání globálního tokenu (GLOBAL JWT)                               | Navazuje na krok 2 |
| 4    | Výběr školy (pokud uživatel patří do více škol)                     | Navazuje na krok 3 |
| 5    | Výběr role (pokud má ve škole více rolí)                            | Navazuje na krok 4 |
| 6    | Vydání školního tokenu (TENANT JWT)                                 | Navazuje na krok 5 |

**Realizuje:** BS-01 (Autentizace a autorizace)

---

#### BP-02: Založení a nastavení školy

| Krok | Business Process                                             |
| ---- | ------------------------------------------------------------ |
| 1    | Vytvoření školy (název, adresa, kontakt, typ)                |
| 2    | Přiřazení administrátora školy                               |
| 3    | Konfigurace nastavení školy (self-registrace, SSO požadavky) |
| 4    | Naplnění struktury školy (ročníky, třídy, předměty)          |

**Realizuje:** BS-02 (Správa systému), BS-03 (Správa školy)  
**Aktér:** BA-01 (Správce systému)

---

#### BP-03: Registrace a správa uživatelů

| Krok | Business Process                                                         |
| ---- | ------------------------------------------------------------------------ |
| 1    | Pozvání uživatele (odeslání e-mailové pozvánky)                          |
| 2    | Alternativa: Vytvoření studenta s rodinou (student + rodiče v transakci) |
| 3    | Alternativa: Hromadný import z CSV                                       |
| 4    | Aktivace účtu (nastavení hesla nebo propojení SSO identity)              |
| 5    | Přiřazení studenta ke třídě                                              |
| 6    | Správa: odebrání ze školy, nastavení absolventa, impersonace             |

**Realizuje:** BS-03 (Správa školy)  
**Aktér:** BA-02 (Ředitel), BA-03 (Zástupce)

---

#### BP-04: Příprava kurikula na školní rok

| Krok | Business Process                                                               |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Vytvoření školního roku (datum začátku a konce)                                |
| 2    | Vytvoření semestrů (1. a 2. pololetí)                                          |
| 3    | Definice ročníků (grade levels)                                                |
| 4    | Vytvoření šablon předmětů (název, kód, popis ŠVP)                              |
| 5    | Vytvoření instancí předmětů (přiřazení předmětů k ročníkům s hodinovou dotací) |
| 6    | Přiřazení učitelských úvazků k instancím předmětů                              |
| 7    | Vytvoření/duplikace verze ŠVP                                                  |
| 8    | Zápis studentů do ročníků                                                      |

**Realizuje:** BS-04 (Správa kurikula)  
**Aktér:** BA-02 (Ředitel), BA-03 (Zástupce)

---

#### BP-05: Tvorba a správa rozvrhu

| Krok | Business Process                                                            |
| ---- | --------------------------------------------------------------------------- |
| 1    | Definice časových slotů (začátek a konec vyučovacích hodin)                 |
| 2    | Vytvoření rozvrhových událostí (předmět + třída + učitel + místnost + slot) |
| 3    | Validace kolizí (učitel, třída, místnost)                                   |
| 4    | Alternativa: hromadné vytvoření událostí (bulk)                             |
| 5    | Alternativa: vizuální plánovač (drag & drop)                                |
| 6    | Zpřístupnění rozvrhu všem aktérům (dle třídy, učitele, studenta)            |

**Sub-proces: Suplování**

| Krok | Business Process                                 |
| ---- | ------------------------------------------------ |
| 1    | Identifikace absence učitele                     |
| 2    | Vytvoření záznamu suplování (přiřazení zástupce) |
| 3    | Notifikace dotčených aktérů                      |

**Realizuje:** BS-05 (Správa rozvrhu), BS-06 (Zobrazení rozvrhu)  
**Aktéři:** BA-02 / BA-03 (Tvorba), všichni (Zobrazení)

---

#### BP-06: Klasifikace a hodnocení

| Krok | Business Process                            |
| ---- | ------------------------------------------- |
| 1    | Zadání známky (hodnota, váha, popis, datum) |
| 2    | Automatický přepočet váženého průměru       |
| 3    | Zobrazení známek: dle třídy nebo studenta   |
| 4    | Zpřístupnění známek studentovi a rodiči     |

**Sub-proces: Tvorba vysvědčení**

| Krok | Business Process                           |
| ---- | ------------------------------------------ |
| 1    | Výběr semestru a třídy                     |
| 2    | Vyplnění slovního hodnocení per student    |
| 3    | Volitelně: AI vylepšení slovního hodnocení |
| 4    | Uložení vysvědčení                         |

**Realizuje:** BS-07 (Klasifikace), BS-08 (Zobrazení klasifikace)  
**Aktéři:** BA-04 (Zadávání), BA-05 / BA-06 (Čtení)

---

#### BP-07: Evidence docházky

| Krok | Business Process                                                               |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Záznam docházky (přítomen / nepřítomen / pozdní / omluven) per student per den |
| 2    | Upsert – aktualizace záznamu pokud již existuje                                |
| 3    | Zobrazení sumáře docházky za období                                            |

**Realizuje:** BS-09 (Evidence docházky)  
**Aktér:** BA-04 (Učitel)

---

#### BP-08: Interní komunikace

| Krok | Business Process                                                          |
| ---- | ------------------------------------------------------------------------- |
| 1    | Přímá zpráva: vyhledání příjemce → vytvoření konverzace → odeslání zprávy |
| 2    | Hromadná zpráva třídě (pouze učitel a vedení)                             |
| 3    | Hromadná zpráva škole (pouze vedení)                                      |
| 4    | Doručení in-app notifikace příjemci                                       |
| 5    | Volitelně: odeslání e-mailové notifikace                                  |
| 6    | Správa notifikací (označení jako přečtené)                                |

**Realizuje:** BS-10 (Komunikace)  
**Aktéři:** Všichni (přímé zprávy), BA-04 + BR-02 (třídní), BR-02 (školní)

---

## 2. Application Layer

### 2.1 Application Components

Hlavní softwarové komponenty systému.

| ID    | Element      | Typ (ArchiMate)       | Popis                                                                                                                 |
| ----- | ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Frontend SPA | Application Component | React single-page aplikace (TypeScript). Uživatelské rozhraní pro všechny role. Komunikuje s backendem přes REST API. |
| AC-02 | Backend API  | Application Component | NestJS aplikace. Obsahuje autentizaci, autorizaci, business logiku a datový přístup přes Prisma ORM.                  |
| AC-03 | MCP Server   | Application Component | Node.js server implementující Model Context Protocol. Poskytuje 36 nástrojů pro programatický přístup k datům.        |

**Vztahy:**

- AC-01 **přistupuje** (Access) k AC-02 přes REST API.
- AC-02 **přistupuje** (Access) k AC-03 přes SSE transport.
- AC-01 i AC-03 jsou **závislé** na AC-02 pro datovou vrstvu.

---

### Sub-komponenty AC-01 (Frontend SPA)

| ID       | Element               | Typ                   | Popis                                                                              |
| -------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| AC-01.1  | Auth Context          | Application Component | Správa JWT tokenů, přihlašovacího stavu, výběru školy a role.                      |
| AC-01.2  | Router                | Application Component | React Router – směrování dle cest, ochrana rout dle role.                          |
| AC-01.3  | Sidebar               | Application Component | Navigační panel – dynamicky zobrazuje položky dle role uživatele a kontextu školy. |
| AC-01.4  | Dashboard Page        | Application Component | Systémový dashboard (sys. admin) nebo školní dashboard (ostatní role).             |
| AC-01.5  | Schedule Page         | Application Component | Zobrazení rozvrhu s filtry (třída, učitel, student, šk. rok, semestr).             |
| AC-01.6  | Grading Page          | Application Component | Zobrazení a správa známek, průměrů.                                                |
| AC-01.7  | Messages Page         | Application Component | Konverzace, hromadné zprávy, notifikace.                                           |
| AC-01.8  | User Management Page  | Application Component | Správa uživatelů školy (filtrování, pozvánky, vazby).                              |
| AC-01.9  | Curriculum Page       | Application Component | Správa kurikula, ŠVP, instancí předmětů.                                           |
| AC-01.10 | Schedule Planner Page | Application Component | Vizuální drag & drop plánovač rozvrhu.                                             |
| AC-01.11 | System Admin Pages    | Application Component | Správa škol, syst. uživatelů, SSO a AI nastavení.                                  |

---

### Sub-komponenty AC-02 (Backend API)

| ID       | Element                  | Typ                   | Popis                                                                      |
| -------- | ------------------------ | --------------------- | -------------------------------------------------------------------------- |
| AC-02.1  | Auth Module              | Application Component | JWT vydávání a validace, SSO (Google, Microsoft), pozvánky, aktivace účtů. |
| AC-02.2  | Guards (Roles, SysAdmin) | Application Component | Middleware pro kontrolu rolí a systémového admina.                         |
| AC-02.3  | Teacher Module           | Application Component | Endpointy pro rozvrh učitele, třídy, zadávání známek a docházky.           |
| AC-02.4  | Student Module           | Application Component | Endpoint pro profil a rozvrh studenta.                                     |
| AC-02.5  | Parent Module            | Application Component | Endpoint pro seznam dětí a dashboard dítěte.                               |
| AC-02.6  | Deputy Module            | Application Component | Správa tříd, místností, předmětů, uživatelů školy.                         |
| AC-02.7  | Deputy Curriculum Module | Application Component | Správa šk. roků, semestrů, ročníků, instancí, ŠVP, úvazků.                 |
| AC-02.8  | Principal Module         | Application Component | Audit log.                                                                 |
| AC-02.9  | System Admin Module      | Application Component | CRUD škol, syst. adminů, SSO, AI, testovací data.                          |
| AC-02.10 | Grading Module           | Application Component | CRUD známek, průměry, vysvědčení, AI polish.                               |
| AC-02.11 | Schedule Module          | Application Component | Časové sloty, události, kolize, suplování.                                 |
| AC-02.12 | Messaging Module         | Application Component | Konverzace, zprávy, broadcasty, notifikace.                                |
| AC-02.13 | AI Module                | Application Component | Chat, streaming, seedování, výběr providera.                               |

---

### Sub-komponenty AC-03 (MCP Server)

| ID      | Element          | Typ                   | Počet nástrojů | Popis                                       |
| ------- | ---------------- | --------------------- | :------------: | ------------------------------------------- |
| AC-03.1 | Analytics Tools  | Application Component |       2        | Sumář docházky, studijní průměry.           |
| AC-03.2 | Curriculum Tools | Application Component |       8        | CRUD šk. roků, ročníků, předmětů, zápisů.   |
| AC-03.3 | Grading Tools    | Application Component |       3        | Zadání známky, výpis známek, docházka.      |
| AC-03.4 | Management Tools | Application Component |       4        | Školy, studenti s rodiči, místnosti.        |
| AC-03.5 | Seeding Tools    | Application Component |       4        | Generování kompletní struktury a dat školy. |
| AC-03.6 | User Tools       | Application Component |       15       | CRUD uživatelů, role, školy, třídy, vazby.  |

---

### 2.2 Application Services

Služby, které aplikační komponenty vystavují ven.

| ID    | Element               | Typ (ArchiMate)     | Poskytuje | Realizuje (Business Service) |
| ----- | --------------------- | ------------------- | --------- | ---------------------------- |
| AS-01 | Autentizační služba   | Application Service | AC-02.1   | BS-01                        |
| AS-02 | Služba správy systému | Application Service | AC-02.9   | BS-02                        |
| AS-03 | Služba správy školy   | Application Service | AC-02.6   | BS-03                        |
| AS-04 | Služba kurikula       | Application Service | AC-02.7   | BS-04                        |
| AS-05 | Služba rozvrhu        | Application Service | AC-02.11  | BS-05, BS-06                 |
| AS-06 | Služba klasifikace    | Application Service | AC-02.10  | BS-07, BS-08                 |
| AS-07 | Služba docházky       | Application Service | AC-02.3   | BS-09                        |
| AS-08 | Služba komunikace     | Application Service | AC-02.12  | BS-10                        |
| AS-09 | Služba AI             | Application Service | AC-02.13  | BS-11                        |
| AS-10 | MCP služba            | Application Service | AC-03     | BS-12                        |

**Vztahy:**

- Application Services **realizují** (Realization) Business Services.
- Application Components **poskytují** Application Services vztahem **Serving**.

### 2.3 Application Interfaces

Rozhraní, kterými jsou služby přístupné.

| ID    | Element        | Typ (ArchiMate)       | Technologie              | Popis                                           |
| ----- | -------------- | --------------------- | ------------------------ | ----------------------------------------------- |
| AI-01 | REST API       | Application Interface | HTTP/JSON                | Hlavní rozhraní backendu. Prefix `/api/`.       |
| AI-02 | Webové UI      | Application Interface | HTML/JS (React)          | Uživatelské rozhraní v prohlížeči (:5173).      |
| AI-03 | MCP Interface  | Application Interface | SSE (Server-Sent Events) | Rozhraní MCP serveru pro AI agenty (:3001).     |
| AI-04 | OAuth Callback | Application Interface | HTTP Redirect            | Callback endpointy pro SSO (Google, Microsoft). |

**Vztahy:**

- AI-01 je **přiřazeno** (Assignment) k AC-02.
- AI-02 je **přiřazeno** k AC-01.
- AI-03 je **přiřazeno** k AC-03.

### 2.4 Data Objects

Klíčové datové entity systému.

| ID    | Element           | Typ (ArchiMate) | Popis                                                              |
| ----- | ----------------- | --------------- | ------------------------------------------------------------------ |
| DO-01 | User              | Data Object     | Uživatel systému (e-mail, jméno, příjmení, avatar, isSystemAdmin). |
| DO-02 | School            | Data Object     | Škola (název, adresa, kontakt, nastavení).                         |
| DO-03 | SchoolMembership  | Data Object     | Vazba uživatele na školu s rolí a statusem.                        |
| DO-04 | StudentProfile    | Data Object     | Profil studenta (jméno, třída).                                    |
| DO-05 | TeacherProfile    | Data Object     | Profil učitele (titul, aprobace, třídnictví).                      |
| DO-06 | Classroom         | Data Object     | Třída (název, ročník).                                             |
| DO-07 | AcademicYear      | Data Object     | Školní rok (název, období, semesters).                             |
| DO-08 | Semester          | Data Object     | Pololetí v rámci školního roku.                                    |
| DO-09 | GradeLevel        | Data Object     | Ročník školy (číslo, název).                                       |
| DO-10 | SubjectTemplate   | Data Object     | Šablona předmětu (název, kód, popis ŠVP).                          |
| DO-11 | SubjectInstance   | Data Object     | Instance předmětu (šablona × ročník × rok, hodinová dotace).       |
| DO-12 | Grade             | Data Object     | Známka (hodnota, váha, popis, datum, student, předmět, učitel).    |
| DO-13 | Attendance        | Data Object     | Záznam docházky (student, datum, status, poznámka).                |
| DO-14 | ScheduleEvent     | Data Object     | Rozvrh. událost (předmět, třída, učitel, místnost, slot, den).     |
| DO-15 | Substitution      | Data Object     | Suplování (původní událost, náhradní učitel).                      |
| DO-16 | Room              | Data Object     | Učebna (název, kapacita, vybavení).                                |
| DO-17 | Conversation      | Data Object     | Konverzace (účastníci).                                            |
| DO-18 | Message           | Data Object     | Zpráva v konverzaci (text, odesílatel, čas).                       |
| DO-19 | Notification      | Data Object     | Notifikace (typ, stav přečtení).                                   |
| DO-20 | CurriculumVersion | Data Object     | Verze ŠVP (název, platnost, záznamy).                              |
| DO-21 | AuditLog          | Data Object     | Záznam audit logu (akce, uživatel, čas, detail).                   |
| DO-22 | ParentStudent     | Data Object     | Vazba rodič–student.                                               |

---

## 3. Technology Layer

Stručný přehled technologické vrstvy.

| ID    | Element                   | Typ (ArchiMate)       | Popis                                             |
| ----- | ------------------------- | --------------------- | ------------------------------------------------- |
| TN-01 | Docker Host               | Node                  | Hostitelský stroj provozující Docker Engine.      |
| TN-02 | Frontend Container        | Node                  | Docker kontejner s Vite dev serverem (port 5173). |
| TN-03 | Backend Container         | Node                  | Docker kontejner s NestJS API (port 3000).        |
| TN-04 | MCP Container             | Node                  | Docker kontejner s MCP serverem (port 3001).      |
| TN-05 | PostgreSQL Container      | Node                  | Docker kontejner s PostgreSQL 15 (port 5432).     |
| TA-01 | React SPA                 | Artifact              | Buildovaná React aplikace (TypeScript, Vite).     |
| TA-02 | NestJS API                | Artifact              | TypeScript backend s Prisma ORM.                  |
| TA-03 | MCP Server App            | Artifact              | TypeScript MCP server s přímým DB přístupem.      |
| TA-04 | PostgreSQL Database       | Artifact              | Relační databáze s Prisma schématem.              |
| TC-01 | HTTP / REST               | Communication Network | Komunikace frontend ↔ backend.                    |
| TC-02 | TCP / PostgreSQL Protocol | Communication Network | Komunikace backend/MCP ↔ databáze.                |
| TC-03 | SSE (Server-Sent Events)  | Communication Network | Komunikace backend ↔ MCP server.                  |
| TC-04 | HTTPS (external)          | Communication Network | Komunikace s Google/Microsoft OAuth a AI API.     |

**Vztahy:**

- Artifacts jsou **nasazeny** (Deployment) na Nodes.
- Application Components jsou **realizovány** Artifacts.

---

## 4. Vztahy mezi vrstvami

### Business → Application (Realization)

| Business Service            | Realizován pomocí (Application)                               |
| --------------------------- | ------------------------------------------------------------- |
| BS-01 Autentizace           | AC-02.1 Auth Module + AC-01.1 Auth Context                    |
| BS-02 Správa systému        | AC-02.9 System Admin Module + AC-01.11 System Admin Pages     |
| BS-03 Správa školy          | AC-02.6 Deputy Module + AC-01.8 User Mgmt + AC-01.4 Dashboard |
| BS-04 Kurikulum             | AC-02.7 Deputy Curriculum Module + AC-01.9 Curriculum Page    |
| BS-05 Správa rozvrhu        | AC-02.11 Schedule Module + AC-01.10 Schedule Planner          |
| BS-06 Zobrazení rozvrhu     | AC-02.11 Schedule Module + AC-01.5 Schedule Page              |
| BS-07 Klasifikace           | AC-02.10 Grading Module + AC-01.6 Grading Page                |
| BS-08 Zobrazení klasifikace | AC-02.10 Grading Module + AC-01.6 Grading Page                |
| BS-09 Docházka              | AC-02.3 Teacher Module                                        |
| BS-10 Komunikace            | AC-02.12 Messaging Module + AC-01.7 Messages Page             |
| BS-11 AI asistent           | AC-02.13 AI Module                                            |
| BS-12 MCP přístup           | AC-03 MCP Server (všechny sub-komponenty)                     |

### Application → Technology (Deployment)

| Application Component | Nasazen na (Technology)    |
| --------------------- | -------------------------- |
| AC-01 Frontend SPA    | TN-02 Frontend Container   |
| AC-02 Backend API     | TN-03 Backend Container    |
| AC-03 MCP Server      | TN-04 MCP Container        |
| Data Objects (DO-\*)  | TN-05 PostgreSQL Container |

### Actor → Service (Serving / Access)

| Business Actor        | Přistupuje přes | K Business Services               |
| --------------------- | --------------- | --------------------------------- |
| BA-01 Správce systému | AI-02 (Web UI)  | BS-01 až BS-12 (všechny)          |
| BA-02 Ředitel         | AI-02 (Web UI)  | BS-01, BS-03 – BS-11              |
| BA-03 Zástupce        | AI-02 (Web UI)  | BS-01, BS-04 – BS-11              |
| BA-04 Učitel          | AI-02 (Web UI)  | BS-01, BS-06 – BS-11              |
| BA-05 Student         | AI-02 (Web UI)  | BS-01, BS-06, BS-08, BS-10, BS-11 |
| BA-06 Rodič           | AI-02 (Web UI)  | BS-01, BS-06, BS-08, BS-10, BS-11 |
| BA-07 AI agent        | AI-03 (MCP)     | BS-12                             |
