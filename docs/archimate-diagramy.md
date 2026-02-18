# EduStack IS – ArchiMate diagramy

> Architektonické diagramy mapující procesy, komponenty a infrastrukturu systému EduStack IS ve stylu ArchiMate (business, application, technology layers).

---

## Obsah

1. [Přehled vrstev (Layered View)](#1-přehled-vrstev)
2. [Business Layer – aktéři a služby](#2-business-layer--aktéři-a-služby)
3. [Procesy – Autentizace](#3-proces--autentizace)
4. [Procesy – Správa školy](#4-proces--správa-školy)
5. [Procesy – Správa uživatelů](#5-proces--správa-uživatelů)
6. [Procesy – Kurikulum](#6-proces--kurikulum)
7. [Procesy – Rozvrh](#7-proces--rozvrh)
8. [Procesy – Klasifikace](#8-proces--klasifikace)
9. [Procesy – Komunikace](#9-proces--komunikace)
10. [Application Layer – komponenty](#10-application-layer--komponenty)
11. [Technology Layer – infrastruktura](#11-technology-layer--infrastruktura)
12. [Integrační pohled](#12-integrační-pohled)

---

## 1. Přehled vrstev

Celkový pohled na systém EduStack IS ve třech ArchiMate vrstvách:

```mermaid
graph TB
    subgraph BL["🏢 BUSINESS LAYER"]
        direction LR
        BA1["👤 Správce systému"]
        BA2["👤 Ředitel"]
        BA3["👤 Zástupce"]
        BA4["👤 Učitel"]
        BA5["👤 Student"]
        BA6["👤 Rodič"]
    end

    subgraph BS["📋 BUSINESS SERVICES"]
        direction LR
        BS1["Autentizace"]
        BS2["Správa škol"]
        BS3["Správa uživatelů"]
        BS4["Kurikulum"]
        BS5["Rozvrh"]
        BS6["Klasifikace"]
        BS7["Docházka"]
        BS8["Komunikace"]
        BS9["AI asistent"]
    end

    subgraph AL["💻 APPLICATION LAYER"]
        direction LR
        AC1["Frontend\n(React SPA)"]
        AC2["Backend API\n(NestJS)"]
        AC3["MCP Server"]
    end

    subgraph TL["⚙️ TECHNOLOGY LAYER"]
        direction LR
        TN1["Docker"]
        TN2["PostgreSQL"]
        TN3["Node.js"]
        TN4["OAuth\nProviders"]
        TN5["AI API\n(OpenAI/Anthropic)"]
    end

    BL --> BS
    BS --> AL
    AL --> TL
```

---

## 2. Business Layer – aktéři a služby

Mapování aktérů (rolí) na business služby, které využívají:

```mermaid
graph LR
    subgraph Actors["AKTÉŘI (Business Actors)"]
        SA["👤 Správce systému"]
        PR["👤 Ředitel"]
        DP["👤 Zástupce"]
        TE["👤 Učitel"]
        ST["👤 Student"]
        PA["👤 Rodič"]
    end

    subgraph Services["BUSINESS SLUŽBY"]
        S1["🔐 Autentizace\na autorizace"]
        S2["🏫 Správa systému\na škol"]
        S3["👥 Správa\nuživatelů"]
        S4["📚 Kurikulum\na ŠVP"]
        S5["📅 Rozvrh\na suplování"]
        S6["📝 Klasifikace\na hodnocení"]
        S7["📊 Docházka"]
        S8["💬 Komunikace"]
        S9["🤖 AI asistent"]
    end

    SA --> S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 & S9
    PR --> S1 & S3 & S4 & S5 & S6 & S7 & S8 & S9
    DP --> S1 & S4 & S5 & S6 & S7 & S8 & S9
    TE --> S1 & S6 & S7 & S8 & S9
    ST --> S1 & S8 & S9
    PA --> S1 & S8 & S9

    style SA fill:#e74c3c,color:#fff
    style PR fill:#3498db,color:#fff
    style DP fill:#2980b9,color:#fff
    style TE fill:#27ae60,color:#fff
    style ST fill:#f39c12,color:#fff
    style PA fill:#8e44ad,color:#fff
```

---

## 3. Proces – Autentizace

```mermaid
flowchart TD
    Start(("🔵 Start")) --> Login{"Způsob\npřihlášení?"}

    Login -->|"E-mail + heslo"| ValidateCred["Ověření\npřihlašovacích údajů"]
    Login -->|"SSO (Google/Microsoft)"| SSORedirect["Přesměrování\nna OAuth provider"]

    SSORedirect --> SSOCallback["Callback\nz OAuth"]
    SSOCallback --> SSOValidate["Ověření SSO tokenu\na párování uživatele"]
    SSOValidate -->|"Nový uživatel"| LinkAccount["Propojení\nSSO identity"]
    SSOValidate -->|"Existující"| IssueGlobal

    ValidateCred -->|"Neplatné"| Error["❌ Chyba:\nNeplatné údaje"]
    ValidateCred -->|"Platné"| IssueGlobal["Vydání\nGLOBAL JWT"]

    LinkAccount --> IssueGlobal

    IssueGlobal --> CheckSchools{"Počet škol\nuživatele?"}

    CheckSchools -->|"0 škol\n(System Admin)"| SysAdminDash["System Admin\nDashboard"]
    CheckSchools -->|"1 škola"| AutoSelect["Automatický výběr\nškoly"]
    CheckSchools -->|"Více škol"| SelectSchool["Výběr školy"]

    SelectSchool --> CheckRoles
    AutoSelect --> CheckRoles{"Počet rolí\nve škole?"}

    CheckRoles -->|"1 role"| IssueTenant["Vydání\nTENANT JWT"]
    CheckRoles -->|"Více rolí"| SelectRole["Výběr role"]
    SelectRole --> IssueTenant

    IssueTenant --> Dashboard["📊 School Dashboard"]

    Error --> Start

    style Start fill:#3498db,color:#fff
    style Dashboard fill:#27ae60,color:#fff
    style SysAdminDash fill:#e74c3c,color:#fff
    style Error fill:#c0392b,color:#fff
```

---

## 4. Proces – Správa školy

```mermaid
flowchart TD
    SA(("👤 Správce\nsystému")) --> SysDash["System Admin\nDashboard"]

    SysDash --> CreateSchool["Vytvořit školu"]
    SysDash --> ManageSchools["Správa\nexistujících škol"]
    SysDash --> SSOConfig["Konfigurace SSO"]
    SysDash --> AIConfig["Konfigurace AI"]
    SysDash --> TestData["Testovací data"]

    CreateSchool --> SetDetails["Nastavit název,\nadresu, kontakt"]
    SetDetails --> AssignAdmin["Přiřadit\nadmina školy"]
    AssignAdmin --> SchoolReady["✅ Škola\naktivní"]

    ManageSchools --> EditSchool["Upravit údaje"]
    ManageSchools --> EditSettings["Upravit nastavení\n(self-registrace, SSO)"]
    ManageSchools --> DeleteSchool["Smazat školu\n(soft delete)"]

    SSOConfig --> ConfigGoogle["Google OAuth"]
    SSOConfig --> ConfigMS["Microsoft OAuth"]
    SSOConfig --> ReloadSSO["Reload providerů"]

    AIConfig --> SetAPIKeys["Nastavit API klíče"]
    AIConfig --> ViewUsage["Zobrazit spotřebu"]

    TestData --> Generate["Generovat\nkompletní data"]
    TestData --> WipeSchool["Smazat data školy"]
    TestData --> WipeAll["Smazat vše"]

    style SA fill:#e74c3c,color:#fff
    style SchoolReady fill:#27ae60,color:#fff
```

---

## 5. Proces – Správa uživatelů

```mermaid
flowchart TD
    Admin(("👤 Ředitel /\nZástupce")) --> UserMgmt["Správa uživatelů"]

    UserMgmt --> ViewUsers["Zobrazit seznam\nuživatelů"]
    UserMgmt --> AddUser{"Přidat\nuživatele"}
    UserMgmt --> ManageUser["Správa\nexistujícího"]

    ViewUsers --> Filter["Filtr: role,\ntřída, status"]
    ViewUsers --> Search["Vyhledávání\ndle jména/emailu"]

    AddUser -->|"Jednotlivě"| InviteUser["Pozvat\ne-mailem"]
    AddUser -->|"Student + rodina"| StudentFamily["Vytvořit studenta\na rodiče"]
    AddUser -->|"Zaměstnanec"| CreateStaff["Vytvořit\nzaměstnance"]
    AddUser -->|"Hromadně"| ImportCSV["Import\nz CSV"]

    InviteUser --> SendInvite["📧 Odeslání\npozvánky"]
    StudentFamily --> CreateProfiles["Vytvoření profilů\n+ vazba rodič-student"]
    CreateStaff --> AssignRole["Přiřazení role\nve škole"]

    SendInvite --> WaitActivation["Čekání na\naktivaci"]
    WaitActivation -->|"Neaktivoval"| ResendInvite["Opakované\nodeslání"]
    WaitActivation -->|"Aktivoval"| UserActive["✅ Uživatel\naktivní"]

    ManageUser --> RemoveUser["Odebrat\nze školy"]
    ManageUser --> SetAlumni["Označit jako\nabsolventa"]
    ManageUser --> Impersonate["Impersonace\n(přihlásit se jako)"]

    CreateProfiles --> UserActive
    AssignRole --> UserActive

    style Admin fill:#3498db,color:#fff
    style UserActive fill:#27ae60,color:#fff
```

---

## 6. Proces – Kurikulum

```mermaid
flowchart TD
    Admin(("👤 Ředitel /\nZástupce")) --> CurrMgmt["Správa kurikula"]

    CurrMgmt --> AcadYear["Akademický rok"]
    CurrMgmt --> GradeLevels["Ročníky"]
    CurrMgmt --> Subjects["Předměty"]
    CurrMgmt --> SVP["ŠVP (verze)"]
    CurrMgmt --> Enrollment["Zápis studentů"]

    AcadYear --> CreateYear["Vytvořit\nškolní rok"]
    CreateYear --> CreateSemesters["Vytvořit\nsemestry"]
    CreateSemesters --> SetCurrent["Nastavit jako\naktuální"]

    GradeLevels --> CreateGL["Vytvořit ročníky\n(1.–9. nebo Prima–Oktáva)"]

    Subjects --> CreateTemplate["Vytvořit šablonu\npředmětu (kód, název)"]
    CreateTemplate --> CreateInstance["Vytvořit instanci:\npředmět → ročník + rok"]
    CreateInstance --> SetHours["Nastavit\nhodinovou dotaci"]
    SetHours --> AssignTeacher["Přiřadit učitelský\núvazek"]

    SVP --> CreateVersion["Vytvořit verzi ŠVP"]
    SVP --> ImportRVP["Import RVP"]
    SVP --> DuplicateVersion["Duplikovat verzi"]
    SVP --> CompareVersions["Porovnat verze"]
    CreateVersion --> AddEntries["Přidat záznamy\n(předměty × ročníky)"]

    Enrollment --> SelectStudents["Vybrat studenty"]
    SelectStudents --> AssignGradeLevel["Přiřadit k ročníku\na třídě"]
    AssignGradeLevel --> EnrollDone["✅ Studenti\nzapsáni"]

    style Admin fill:#3498db,color:#fff
    style EnrollDone fill:#27ae60,color:#fff
```

---

## 7. Proces – Rozvrh

```mermaid
flowchart TD
    Admin(("👤 Ředitel /\nZástupce")) --> ScheduleMgmt["Správa rozvrhu"]

    ScheduleMgmt --> TimeSlots["Definice\nčasových slotů"]
    ScheduleMgmt --> Events["Rozvrhové\nudálosti"]
    ScheduleMgmt --> Substitutions["Suplování"]
    ScheduleMgmt --> Planner["Vizuální\nplánovač"]

    TimeSlots --> DefineSlots["Nastavit začátek\na konec hodin"]

    Events --> CreateEvent["Vytvořit událost"]
    Events --> BulkCreate["Hromadné\nvytvoření"]
    CreateEvent --> SelectParams["Vybrat: předmět,\ntřída, učitel, místnost"]
    SelectParams --> ValidateCollision["Validace kolizí"]
    ValidateCollision -->|"Kolize"| CollisionError["⚠️ Kolize\ndetekována"]
    ValidateCollision -->|"OK"| SaveEvent["✅ Uložit\nudálost"]

    BulkCreate --> ValidateCollision

    Substitutions --> CreateSub["Vytvořit\nsuplování"]
    CreateSub --> SelectOriginal["Vybrat původní\nudálost"]
    SelectOriginal --> AssignSubTeacher["Přiřadit\nzástupce"]

    Planner --> DragDrop["Drag & drop\nrozvrhových bloků"]
    DragDrop --> ValidateCollision

    subgraph Views["ZOBRAZENÍ (všechny role)"]
        ViewClass["📅 Rozvrh třídy"]
        ViewTeacher["📅 Rozvrh učitele"]
        ViewStudent["📅 Rozvrh studenta"]
    end

    SaveEvent --> Views

    style Admin fill:#3498db,color:#fff
    style SaveEvent fill:#27ae60,color:#fff
    style CollisionError fill:#e67e22,color:#fff
```

---

## 8. Proces – Klasifikace

```mermaid
flowchart TD
    Teacher(("👤 Učitel")) --> GradingFlow["Klasifikace"]

    GradingFlow --> CreateGrade["Zadat známku"]
    GradingFlow --> ViewGrades["Zobrazit známky"]
    GradingFlow --> ReportCards["Vysvědčení"]

    CreateGrade --> SelectStudent["Vybrat studenta\na předmět"]
    SelectStudent --> SetGrade["Nastavit hodnotu,\nváhu, popis"]
    SetGrade --> SaveGrade["✅ Známka\nuložena"]

    SaveGrade --> CalcAverage["Přepočet\nváženého průměru"]

    ViewGrades --> ByClass["Dle třídy"]
    ViewGrades --> ByStudent["Dle studenta"]
    ByStudent --> ShowAverage["Zobrazit průměry\nz předmětů"]

    ReportCards --> SelectSemester["Vybrat semestr\na třídu"]
    SelectSemester --> FillVerbal["Vyplnit slovní\nhodnocení"]
    FillVerbal --> AIPolish{"Použít AI\npolish?"}
    AIPolish -->|"Ano"| AIProcess["🤖 AI vylepší\ntext"]
    AIPolish -->|"Ne"| SaveReport
    AIProcess --> SaveReport["✅ Vysvědčení\nuloženo"]

    subgraph StudentView["POHLED STUDENTA"]
        SV1["📊 Vlastní známky"]
        SV2["📊 Vlastní průměry"]
    end

    subgraph ParentView["POHLED RODIČE"]
        PV1["📊 Známky dítěte"]
        PV2["📊 Průměry dítěte"]
    end

    SaveGrade -.-> StudentView
    SaveGrade -.-> ParentView

    style Teacher fill:#27ae60,color:#fff
    style SaveGrade fill:#27ae60,color:#fff
    style SaveReport fill:#27ae60,color:#fff
```

---

## 9. Proces – Komunikace

```mermaid
flowchart TD
    User(("👤 Uživatel\n(libovolná role)")) --> Messaging["Zprávy"]

    Messaging --> DirectMsg["Přímá zpráva"]
    Messaging --> BroadcastMsg["Hromadná zpráva"]
    Messaging --> Notifications["Notifikace"]

    DirectMsg --> FindRecipient["Vyhledat\npříjemce"]
    FindRecipient --> CreateConv["Vytvořit\nkonverzaci"]
    CreateConv --> SendMsg["Odeslat zprávu"]
    SendMsg --> NotifyRecipient["📧 Notifikace\npříjemci"]

    BroadcastMsg --> ClassBroadcast["Zpráva třídě\n(učitel+)"]
    BroadcastMsg --> SchoolBroadcast["Zpráva škole\n(vedení)"]

    ClassBroadcast --> SelectClass["Vybrat třídu"]
    SchoolBroadcast --> ComposeSchool["Napsat zprávu\npro celou školu"]
    SelectClass --> ComposeClass["Napsat zprávu"]
    ComposeClass --> BroadcastSend["📨 Odeslat\nvšem ve třídě"]
    ComposeSchool --> BroadcastSendSchool["📨 Odeslat\nvšem ve škole"]

    Notifications --> ViewNotif["Zobrazit\nnotifikace"]
    Notifications --> MarkRead["Označit jako\npřečtené"]
    Notifications --> ToggleEmail["Zapnout/vypnout\ne-mailové notifikace"]

    NotifyRecipient --> InApp["🔔 In-app\nnotifikace"]
    NotifyRecipient --> Email{"E-mail\nzapnutý?"}
    Email -->|"Ano"| SendEmail["📧 E-mail"]
    Email -->|"Ne"| InApp

    style User fill:#9b59b6,color:#fff
```

---

## 10. Application Layer – komponenty

```mermaid
graph TB
    subgraph Frontend["FRONTEND (React SPA)"]
        direction TB
        FRouter["React Router\n(směrování)"]
        FAuth["Auth Context\n(JWT správa)"]
        FSidebar["Sidebar\n(navigace dle role)"]

        subgraph FPages["STRÁNKY"]
            FPLogin["Login"]
            FPDashboard["Dashboard"]
            FPSchedule["Schedule"]
            FPGrading["Grading"]
            FPMessages["Messages"]
            FPUsers["User Management"]
            FPCurriculum["Curriculum"]
            FPWhiteBook["White Book"]
            FPSysAdmin["System Admin"]
        end
    end

    subgraph Backend["BACKEND (NestJS)"]
        direction TB
        BAuth["Auth Module\n(JWT + SSO)"]
        BGuards["Guards\n(Roles + SysAdmin)"]

        subgraph BControllers["CONTROLLERS"]
            BCAuth["AuthController"]
            BCTeacher["TeacherController"]
            BCStudent["StudentController"]
            BCParent["ParentController"]
            BCDeputy["DeputyController"]
            BCPrincipal["PrincipalController"]
            BCSysAdmin["SystemAdminController"]
            BCGrading["GradingController"]
            BCSchedule["ScheduleController"]
            BCMessaging["MessagingController"]
            BCAi["AiController"]
        end

        subgraph BServices["SERVICES"]
            BSAuth["AuthService"]
            BSUsers["UsersService"]
            BSGrading["GradingService"]
            BSSchedule["ScheduleService"]
            BSMessaging["MessagingService"]
            BSCurriculum["CurriculumService"]
            BSAi["AiService"]
        end
    end

    subgraph MCP["MCP SERVER"]
        direction TB
        MCPAnalytics["Analytics Tools (2)"]
        MCPCurriculum["Curriculum Tools (8)"]
        MCPGrading["Grading Tools (3)"]
        MCPManagement["Management Tools (4)"]
        MCPSeeding["Seeding Tools (4)"]
        MCPUsers["User Tools (15)"]
    end

    Frontend -->|"REST API\n(HTTP/JSON)"| Backend
    MCP -->|"Prisma\n(Direct DB)"| DB[("PostgreSQL")]
    Backend -->|"Prisma ORM"| DB
    Backend -->|"OAuth 2.0"| OAuth["Google / Microsoft"]
    Backend -->|"API calls"| AIProvider["OpenAI / Anthropic"]

    style Frontend fill:#61dafb,color:#000
    style Backend fill:#e0234e,color:#fff
    style MCP fill:#8e44ad,color:#fff
    style DB fill:#336791,color:#fff
```

---

## 11. Technology Layer – infrastruktura

```mermaid
graph TB
    subgraph Docker["DOCKER COMPOSE"]
        subgraph FrontendContainer["📦 frontend"]
            Vite["Vite Dev Server\n:5173"]
            React["React 18\n+ TypeScript"]
        end

        subgraph BackendContainer["📦 backend"]
            NestJS["NestJS\n:3000"]
            Prisma["Prisma ORM"]
            Passport["Passport.js\n(JWT + OAuth)"]
        end

        subgraph MCPContainer["📦 mcp-server"]
            MCPNode["Node.js\n:3001"]
            MCPPrisma["Prisma Client"]
            MCPSDK["@modelcontextprotocol\n/sdk"]
        end

        subgraph DBContainer["📦 postgres"]
            PG["PostgreSQL 15\n:5432"]
            PGData[("Volume:\npostgres-data")]
        end
    end

    subgraph External["EXTERNÍ SLUŽBY"]
        Google["Google OAuth"]
        Microsoft["Microsoft OAuth"]
        OpenAI["OpenAI API"]
        Anthropic["Anthropic API"]
        SMTP["SMTP Server\n(e-mail notifikace)"]
    end

    FrontendContainer -->|"HTTP :3000"| BackendContainer
    BackendContainer -->|"TCP :5432"| DBContainer
    MCPContainer -->|"TCP :5432"| DBContainer
    BackendContainer -->|"SSE :3001"| MCPContainer

    BackendContainer --> Google & Microsoft
    BackendContainer --> OpenAI & Anthropic
    BackendContainer --> SMTP

    PG --- PGData

    style Docker fill:#2496ed,color:#fff
    style FrontendContainer fill:#61dafb,color:#000
    style BackendContainer fill:#e0234e,color:#fff
    style MCPContainer fill:#8e44ad,color:#fff
    style DBContainer fill:#336791,color:#fff
```

---

## 12. Integrační pohled

Celkový pohled na datové toky mezi vrstvami a komponentami:

```mermaid
graph LR
    subgraph Users["UŽIVATELÉ"]
        U1["👤 Správce"]
        U2["👤 Ředitel"]
        U3["👤 Učitel"]
        U4["👤 Student"]
        U5["👤 Rodič"]
    end

    subgraph UI["WEBOVÉ ROZHRANÍ"]
        Browser["🌐 Prohlížeč\n(React SPA)"]
    end

    subgraph API["REST API"]
        Auth["/api/auth"]
        System["/api/system"]
        Deputy["/api/deputy"]
        Teacher["/api/teacher"]
        Student["/api/student"]
        Parent["/api/parent"]
        Grading["/api/grading"]
        Schedule["/api/schedule"]
        Messaging["/api/messaging"]
        AI["/api/ai"]
    end

    subgraph MCPLayer["MCP PROTOKOL"]
        MCPTools["36 nástrojů\n(SSE transport)"]
    end

    subgraph Data["DATOVÁ VRSTVA"]
        DB[("PostgreSQL\n(Prisma)")]
    end

    subgraph ExtServices["EXTERNÍ"]
        OAuth["OAuth 2.0\n(Google/MS)"]
        AIApi["AI API\n(OpenAI)"]
    end

    Users --> Browser
    Browser --> API
    API --> DB
    MCPTools --> DB
    API --> OAuth
    API --> AIApi
    AI --> MCPTools

    style Users fill:#ecf0f1,color:#000
    style UI fill:#3498db,color:#fff
    style API fill:#e74c3c,color:#fff
    style MCPLayer fill:#8e44ad,color:#fff
    style Data fill:#336791,color:#fff
    style ExtServices fill:#f39c12,color:#fff
```
