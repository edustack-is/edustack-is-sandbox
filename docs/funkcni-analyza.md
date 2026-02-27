# EduStack IS – Funkční analýza

> Přehled funkcí, které by měl školní informační systém obsahovat, s vyznačením aktuálního stavu implementace.

---

## Obsah

1. [Úvod](#1-úvod)
2. [Autentizace a správa identit](#2-autentizace-a-správa-identit)
3. [Správa systému](#3-správa-systému)
4. [Správa školy](#4-správa-školy)
5. [Správa uživatelů](#5-správa-uživatelů)
6. [Kurikulum a vzdělávací plány](#6-kurikulum-a-vzdělávací-plány)
7. [Rozvrh](#7-rozvrh)
8. [Klasifikace a hodnocení](#8-klasifikace-a-hodnocení)
9. [Docházka](#9-docházka)
10. [Komunikace](#10-komunikace)
11. [Třídní kniha](#11-třídní-kniha)
12. [AI funkce](#12-ai-funkce)
13. [Programatický přístup (MCP)](#13-programatický-přístup-mcp)
14. [Reporty a výstupy](#14-reporty-a-výstupy)
15. [Infrastruktura a provoz](#15-infrastruktura-a-provoz)
16. [Souhrnná tabulka](#16-souhrnná-tabulka)

**Legenda:**
- ✅ Implementováno
- 🔶 Částečně implementováno
- ❌ Neimplementováno

---

## 1. Úvod

Tato analýza mapuje funkce, které by měl obsahovat moderní školní informační systém pro základní a střední školy v českém prostředí. Vychází z porovnání s existujícími systémy (Bakaláři, EduPage, Edookit) a požadavků RVP/ŠVP. U každé funkce je vyznačen aktuální stav implementace v systému EduStack IS.

---

## 2. Autentizace a správa identit

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F001 | Přihlášení e-mailem a heslem | ✅ | |
| F002 | SSO – Google OAuth | ✅ | Konfigurovatelné správcem systému |
| F003 | SSO – Microsoft OAuth | ✅ | Konfigurovatelné správcem systému |
| F004 | Aktivace účtu přes pozvánku | ✅ | E-mailová pozvánka s odkazem |
| F005 | Výběr školy po přihlášení | ✅ | Podpora více škol na jednom účtu |
| F006 | Výběr role při vstupu do školy | ✅ | Pokud má uživatel více rolí |
| F007 | JWT tokeny (globální a školní) | ✅ | GLOBAL a TENANT typy |
| F008 | Role-based přístupová kontrola | ✅ | Guards na úrovni API |
| F009 | Impersonace uživatele | ✅ | Pro adminy – přihlášení jako jiný uživatel |
| F010 | Nahrání avataru | ✅ | |
| F011 | Úprava vlastního profilu | ✅ | |
| F012 | Self-registrace studentů | ✅ | Volitelná, konfigurovatelná per škola |
| F013 | Reset hesla (zapomenuté heslo) | ✅ | BE-11 |
| F014 | Politika síly hesel | ✅ | Min 8 znaků, velké/malé písmeno, číslice; ukazatel síly |
| F015 | Omezení počtu neúspěšných pokusů | ✅ | Zamčení účtu po 5 pokusech na 15 minut |
| F016 | Dvoufaktorové ověřování (2FA) | ❌ | |
| F017 | SSO – SAML / LDAP integrace | ❌ | Pro školy navázané na AD |

---

## 3. Správa systému

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F018 | Dashboard systému | ✅ | Počet škol, uživatelů, členství |
| F019 | CRUD škol | ✅ | Název, adresa, kontakt, typ |
| F020 | Správa systémových administrátorů | ✅ | Povýšení/degradace |
| F021 | Konfigurace SSO providerů | ✅ | Google, Microsoft |
| F022 | Konfigurace AI | ✅ | API klíče, výběr poskytovatele |
| F023 | Statistiky spotřeby AI | ✅ | |
| F024 | Generování testovacích dat | ✅ | Kompletní škola s uživateli a daty |
| F025 | Soft delete škol | ✅ | Data zůstávají v databázi |
| F026 | Globální nastavení systému | ✅ | Key-value configuř (bezpečnost, obecné), UI záložka |
| F027 | Monitoring a log systému | ✅ | Health endpoint, ELK stack, Grafana, systémový audit log |
| F028 | Záloha a obnova dat | ✅ | pg_dump/restore přes API, UI správa záloh |
| F029 | Multi-tenancy konfigurace | ✅ | Vícero škol v jedné instanci |

---

## 4. Správa školy

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F030 | Dashboard školy | ✅ | Statistiky studentů, tříd, učitelů, předmětů |
| F031 | CRUD tříd | ✅ | Název, ročník |
| F032 | CRUD místností/učeben | ✅ | Kapacita, vybavení, PC učebna |
| F033 | CRUD šablon předmětů | ✅ | Název, kód, popis ŠVP |
| F034 | Nastavení školy | ✅ | Self-registrace, SSO požadavky |
| F035 | Audit log | ✅ | Záznam citlivých operací |
| F036 | Třídní učitel (homeroom) | ✅ | Přiřazení v profilu učitele |
| F037 | Správa budov a areálů | ✅ | CRUD budov, přiřazení pokojů k budovám, podlaží |
| F038 | Sdílení místností mezi školami | ✅ | Sdílení a odebírání přístupu, M:N tabulka |
| F039 | Školní rok – přehled událostí | ✅ | CRUD událostí, dashboard upcoming, typ události |

---

## 5. Správa uživatelů

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F040 | Pozvání uživatele (e-mail) | ✅ | |
| F041 | Vytvoření studenta s rodinou | ✅ | Student + rodiče v jedné transakci |
| F042 | Vytvoření zaměstnance | ✅ | |
| F043 | Import uživatelů z CSV | ✅ | |
| F044 | Opakované odeslání pozvánky | ✅ | |
| F045 | Odebrání uživatele ze školy | ✅ | |
| F046 | Nastavení absolventa (alumni) | ✅ | |
| F047 | Filtrování dle role a třídy | ✅ | |
| F048 | Stránkování seznamu uživatelů | ✅ | |
| F049 | Vazby rodič–student | ✅ | Zobrazení v tabulce |
| F050 | Hromadné vytvoření uživatelů (batch) | ✅ | Přes MCP |
| F051 | Editace údajů uživatele | ✅ | Dialog pro úpravu jména, emailu, úvazku |
| F052 | Správa oprávnění uživatele | ✅ | Změna role v editačním dialogu |
| F053 | Deaktivace/suspendování uživatele | ✅ | Suspend/reactivate tlačítka v tabulce |
| F054 | Export uživatelů (CSV/Excel) | ✅ | CSV export s BOM pro Excel |
| F055 | Fotogalerie třídy | ❌ | |
| F056 | Hromadný import z XML (Bakaláři formát) | ❌ | |

---

## 6. Kurikulum a vzdělávací plány

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F057 | CRUD školních roků | ✅ | Název, datum, aktuální rok |
| F058 | Správa semestrů (pololetí) | ✅ | Propojení s akademickým rokem |
| F059 | CRUD ročníků (grade levels) | ✅ | |
| F060 | CRUD instancí předmětů | ✅ | Přiřazení k ročníku, roku, hodinová dotace |
| F061 | Správa učitelských úvazků | ✅ | |
| F062 | Verzování ŠVP | ✅ | CRUD, duplikace, porovnání verzí |
| F063 | Definice záznamů ŠVP (entries) | ✅ | Přiřazení předmětů k ročníkům v rámci verze |
| F064 | Import RVP | ✅ | Upload a potvrzení |
| F065 | Zápis studentů do ročníků | ✅ | Hromadný enrollement |
| F066 | Tematické plány | ✅ | Rozpis učiva po hodinách/týdnech |
| F067 | Přípravy na hodiny | ✅ | CRUD s průběhem, cíli, reflexí |
| F068 | Elektronické učebnice / materiály | ✅ | URL-based, typ badge, filtrování |
| F069 | Výstupy dle RVP – mapování kompetencí | ✅ | Matice předmět × ročník, click-to-toggle |

---

## 7. Rozvrh

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F070 | Definice časových slotů | ✅ | Začátek a konec hodin |
| F071 | CRUD rozvrhových událostí | ✅ | Jednotlivě i hromadně (bulk) |
| F072 | Validace kolizí | ✅ | Kontrola překryvů učitel/třída/místnost |
| F073 | Zobrazení rozvrhu třídy | ✅ | |
| F074 | Zobrazení rozvrhu učitele | ✅ | |
| F075 | Zobrazení rozvrhu studenta | ✅ | |
| F076 | CRUD suplování | ✅ | |
| F077 | Vizuální plánovač rozvrhu | ✅ | Drag & drop rozhraní |
| F078 | Filtr dle školního roku a semestru | ✅ | |
| F079 | Automatické generování rozvrhu | ✅ | Greedy constraint-based algoritmus (třída→ročník→předmět) |
| F080 | Tisk rozvrhu | ✅ | HTML export s CSS print styles |
| F081 | Zobrazení změn (diff) rozvrhu | ✅ | Snapshoty + barevné porovnání (přidáno/odebráno/změněno) |
| F082 | Zvonění / časový harmonogram | ✅ | Label, přestávky, vizuální timeline, samostatná stránka |
| F083 | Opakující se události (kroužky) | ✅ | CRUD s přiřazením místnosti a vedoucího, pohled dle dne |
| F084 | Sdílení místností mezi třídami | ✅ | Přes kolizní validaci |

---

## 8. Klasifikace a hodnocení

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F085 | CRUD známek | ✅ | Hodnota, váha, popis, datum |
| F086 | Zobrazení známek dle třídy | ✅ | |
| F087 | Zobrazení známek dle studenta | ✅ | |
| F088 | Výpočet vážených průměrů | ✅ | |
| F089 | Vysvědčení (report cards) | ✅ | Upsert per student/semestr |
| F090 | AI polish slovního hodnocení | ✅ | Automatické vylepšení textu |
| F091 | Typy hodnocení dle třídy | ✅ | |
| F092 | Slovní hodnocení | ✅ | Součást vysvědčení |
| F093 | Zobrazení známek pro studenta (self) | ✅ | Student vidí vlastní známky |
| F094 | Zobrazení známek pro rodiče | ✅ | Rodič vidí známky dětí |
| F095 | Chování (hodnocení chování) | ✅ | BehaviorGrade model, upsert per student/semestr |
| F096 | Hodnocení dle kompetencí (formativní) | ✅ | CompetencyGrade matice student × kompetence |
| F097 | Výchovná opatření (pochvaly, důtky) | ✅ | CRUD, typy: pochvala/důtka/důtka TU/důtka ŘŠ, stránka |
| F098 | Grafické zobrazení vývoje známek | ✅ | API pro historii známek, graf po čase |
| F099 | Export vysvědčení do PDF | ✅ | HTML tabulka s CSS print styles |
| F100 | Komisionální přezkoušení | ✅ | CRUD, sledování původní a nové známky |
| F101 | Uzavření klasifikace (deadline) | ✅ | Deadline + zámek, upsert per semestr |

---

## 9. Docházka

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F102 | Záznam docházky (přítomen, nepřítomen, pozdní, omluven) | ✅ | |
| F103 | Sumář docházky za období | ✅ | Přes MCP analytiku |
| F104 | Docházka per hodina | ✅ | lessonNumber per záznam, napojeno na UI stránku |
| F105 | Omlouvání absence rodičem | ✅ | AbsenceExcuse model, review workflow |
| F106 | Automatické upozornění při absenci | ✅ | Notifikace rodičům přes ParentStudent |
| F107 | Statistiky docházky třídy | ✅ | Agregáty per student, tabulka |
| F108 | Export docházky | ✅ | CSV export s BOM |
| F109 | Neomluvené hodiny – eskalace | ✅ | Alert pro studenty nad prahem |

---

## 10. Komunikace

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F110 | Přímé konverzace (1:1) | ✅ | |
| F111 | Hromadná zpráva třídě | ✅ | Pro učitele a vedení |
| F112 | Hromadná zpráva škole | ✅ | Pro vedení školy |
| F113 | Notifikace (in-app) | ✅ | Počítadlo nepřečtených |
| F114 | Označení notifikací jako přečtených | ✅ | Jednotlivě i hromadně |
| F115 | E-mailové notifikace | ✅ | Zapnutí/vypnutí per uživatel |
| F116 | Vyhledávání příjemců | ✅ | |
| F117 | Skupinové konverzace | ✅ | Více účastníků, typ GROUP |
| F118 | Přílohy ve zprávách | ✅ | MessageAttachment + AI moderace (Gemini text + MIME whitelist) |
| F119 | Nástěnka / oznámení školy | ✅ | BulletinPost, připínání |
| F120 | Ankety a dotazníky | ✅ | Poll + PollOption + PollVote, multi-select |
| F121 | Kalendář událostí s RSVP | ✅ | CalendarEvent + EventRsvp (YES/NO/MAYBE) |

---

## 11. Třídní kniha

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F122 | White Book – zobrazení | ✅ | Základní zobrazení dat |
| F123 | Elektronická třídní kniha | ✅ | ClassBookEntry + ScheduleEvent link |
| F124 | Zápis probíraného učiva | ✅ | Inline editace, auto-prefill z rozvrhu |
| F125 | Zápis poznámek k hodině | ✅ | Poznámky + počet nepřítomných |
| F126 | Propojení s rozvrhem a docházkou | ✅ | Automatické předvyplnění z ScheduleEvent |
| F127 | Podpis učitele (elektronický) | ✅ | TeacherSignature s IP + timestamp |
| F128 | Tisk třídní knihy | ✅ | HTML export s rozsahem dat |

---

## 12. AI funkce

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F129 | Konverzační AI chat | ✅ | Streaming odpovědí |
| F130 | AI polish slovního hodnocení | ✅ | Automatické vylepšení textu |
| F131 | Seedování dat pomocí AI | ✅ | Generování testovacích dat |
| F132 | Výběr AI poskytovatele | ✅ | OpenAI, Anthropic apod. |
| F133 | AI generování tematických plánů | ✅ | Gemini generuje markdown tabulku |
| F134 | AI doporučení pro studenty | ✅ | Na základě známek, docházky, chování |
| F135 | AI generování slovního hodnocení | ✅ | Funkce refineText u formulářového pole |
| F136 | AI analýza prospěchu třídy | ✅ | Statistiky + doporučení pro učitele |
| F137 | AI generování testů | ✅ | Otázky s odpověďmi a body |
| F138 | AI generování písemek | ✅ | Varianty s klasifikační tabulkou |
| F139 | AI detekce škodlivého obsahu | ✅ | Gemini moderace ve zprávách |

---

## 13. Programatický přístup (MCP)

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F140 | MCP server pro AI agenty | ✅ | 36 nástrojů |
| F141 | Analytika (docházka, prospěch) | ✅ | 2 nástroje |
| F142 | Kurikulum (šk. roky, předměty, zápisy) | ✅ | 8 nástrojů |
| F143 | Klasifikace a docházka | ✅ | 3 nástroje |
| F144 | Správa (školy, místnosti) | ✅ | 4 nástroje |
| F145 | Seeding (generování dat) | ✅ | 4 nástroje |
| F146 | Uživatelé a školy | ✅ | 15 nástrojů |
| F147 | REST API pro externí integrace | ✅ | OpenAPI/Swagger na /api/docs, 17 tagů |
| F148 | Webhooky | ❌ | Notifikace o změnách pro ext. systémy |
| F149 | CSV/XML/JSON export dat | ✅ | 5 entit × 3 formáty |

---

## 14. Reporty a výstupy

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F150 | Dashboard se statistikami | ✅ | Systémový i školní |
| F151 | Audit log | ✅ | |
| F152 | AI spotřeba | ✅ | |
| F153 | Export vysvědčení do PDF | ✅ | HTML export vysvědčení třídy |
| F154 | Tisk rozvrhu | ✅ | HTML export rozvrhu třídy |
| F155 | Statistiky prospěchu (třídy, ročníky) | ✅ | Průměr, medián, distribuce, úspěšnost |
| F156 | Statistiky docházky | ✅ | API + per-student breakdown |
| F157 | Výkazy pro ČŠI | ✅ | JSON + tisknutelné HTML |
| F158 | Výkazy pro MŠMT | ✅ | JSON + tisknutelné HTML |
| F159 | Export dat do tabulkového formátu | ✅ | CSV/XML/JSON (ExportModule) |

---

## 15. Infrastruktura a provoz

| ID | Funkce | Stav | Poznámka |
|:---|--------|:----:|----------|
| F160 | Docker deployment | ✅ | docker-compose |
| F161 | PostgreSQL databáze | ✅ | Via Prisma ORM |
| F162 | Responsivní webové rozhraní | ✅ | React s mobilním layoutem |
| F163 | Lokalizace (CZ/EN) | ✅ | Přepínání jazyku |
| F164 | Dark mode | ✅ | ThemeToggle (light/dark/system) |
| F165 | PWA (Progressive Web App) | ✅ | manifest.json + Service Worker |
| F166 | Automatické zálohy | ✅ | AUTO_BACKUP cron každý den 2:00 |
| F167 | Rate limiting | ✅ | Globální ThrottlerGuard + zámek účtů |
| F168 | GDPR nástroje | ✅ | Export + anonymizace osobních dat |
| F169 | Mobilní aplikace | ❌ | iOS / Android |

---

## 16. Souhrnná tabulka

| Oblast | Celkem funkcí | ✅ Implementováno | 🔶 Částečně | ❌ Chybí |
|--------|:---:|:---:|:---:|:---:|
| F170 | Autentizace a identity | 17 | 15 | 0 | 2 |
| F171 | Správa systému | 12 | 12 | 0 | 0 |
| F172 | Správa školy | 10 | 10 | 0 | 0 |
| F173 | Správa uživatelů | 17 | 15 | 0 | 2 |
| F174 | Kurikulum | 13 | 13 | 0 | 0 |
| F175 | Rozvrh | 15 | 15 | 0 | 0 |
| F176 | Klasifikace | 17 | 17 | 0 | 0 |
| F177 | Docházka | 8 | 8 | 0 | 0 |
| F178 | Komunikace | 12 | 12 | 0 | 0 |
| F179 | Třídní kniha | 7 | 7 | 0 | 0 |
| F180 | AI funkce | 11 | 11 | 0 | 0 |
| F181 | MCP | 10 | 9 | 0 | 1 |
| F182 | Reporty a výstupy | 10 | 10 | 0 | 0 |
| F183 | Infrastruktura | 10 | 9 | 0 | 1 |
| **Celkem** | **169** | **163** | **0** | **6** |

**Pokrytí:** přibližně **96 %** požadovaných funkcí je plně implementováno.
