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

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Přihlášení e-mailem a heslem | ✅ | |
| SSO – Google OAuth | ✅ | Konfigurovatelné správcem systému |
| SSO – Microsoft OAuth | ✅ | Konfigurovatelné správcem systému |
| Aktivace účtu přes pozvánku | ✅ | E-mailová pozvánka s odkazem |
| Výběr školy po přihlášení | ✅ | Podpora více škol na jednom účtu |
| Výběr role při vstupu do školy | ✅ | Pokud má uživatel více rolí |
| JWT tokeny (globální a školní) | ✅ | GLOBAL a TENANT typy |
| Role-based přístupová kontrola | ✅ | Guards na úrovni API |
| Impersonace uživatele | ✅ | Pro adminy – přihlášení jako jiný uživatel |
| Nahrání avataru | ✅ | |
| Úprava vlastního profilu | ✅ | |
| Self-registrace studentů | ✅ | Volitelná, konfigurovatelná per škola |
| Reset hesla (zapomenuté heslo) | ✅ | E-mail s odkazem, platnost 1 hodina |
| Politika síly hesel | ✅ | Min 8 znaků, velké/malé písmeno, číslice; ukazatel síly |
| Omezení počtu neúspěšných pokusů | ✅ | Zamčení účtu po 5 pokusech na 15 minut |
| Dvoufaktorové ověřování (2FA) | ❌ | |
| SSO – SAML / LDAP integrace | ❌ | Pro školy navázané na AD |

---

## 3. Správa systému

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Dashboard systému | ✅ | Počet škol, uživatelů, členství |
| CRUD škol | ✅ | Název, adresa, kontakt, typ |
| Správa systémových administrátorů | ✅ | Povýšení/degradace |
| Konfigurace SSO providerů | ✅ | Google, Microsoft |
| Konfigurace AI | ✅ | API klíče, výběr poskytovatele |
| Statistiky spotřeby AI | ✅ | |
| Generování testovacích dat | ✅ | Kompletní škola s uživateli a daty |
| Soft delete škol | ✅ | Data zůstávají v databázi |
| Globální nastavení systému | ✅ | Key-value configuř (bezpečnost, obecné), UI záložka |
| Monitoring a log systému | ✅ | Health endpoint, ELK stack, Grafana, systémový audit log |
| Záloha a obnova dat | ✅ | pg_dump/restore přes API, UI správa záloh |
| Multi-tenancy konfigurace | ✅ | Vícero škol v jedné instanci |

---

## 4. Správa školy

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Dashboard školy | ✅ | Statistiky studentů, tříd, učitelů, předmětů |
| CRUD tříd | ✅ | Název, ročník |
| CRUD místností/učeben | ✅ | Kapacita, vybavení, PC učebna |
| CRUD šablon předmětů | ✅ | Název, kód, popis ŠVP |
| Nastavení školy | ✅ | Self-registrace, SSO požadavky |
| Audit log | ✅ | Záznam citlivých operací |
| Třídní učitel (homeroom) | ✅ | Přiřazení v profilu učitele |
| Správa budov a areálů | ✅ | CRUD budov, přiřazení pokojů k budovám, podlaží |
| Sdílení místností mezi školami | ✅ | Sdílení a odebírání přístupu, M:N tabulka |
| Školní rok – přehled událostí | ✅ | CRUD událostí, dashboard upcoming, typ události |

---

## 5. Správa uživatelů

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Pozvání uživatele (e-mail) | ✅ | |
| Vytvoření studenta s rodinou | ✅ | Student + rodiče v jedné transakci |
| Vytvoření zaměstnance | ✅ | |
| Import uživatelů z CSV | ✅ | |
| Opakované odeslání pozvánky | ✅ | |
| Odebrání uživatele ze školy | ✅ | |
| Nastavení absolventa (alumni) | ✅ | |
| Filtrování dle role a třídy | ✅ | |
| Stránkování seznamu uživatelů | ✅ | |
| Vazby rodič–student | ✅ | Zobrazení v tabulce |
| Hromadné vytvoření uživatelů (batch) | ✅ | Přes MCP |
| Editace údajů uživatele | ✅ | Dialog pro úpravu jména, emailu, úvazku |
| Správa oprávnění uživatele | ✅ | Změna role v editačním dialogu |
| Deaktivace/suspendování uživatele | ✅ | Suspend/reactivate tlačítka v tabulce |
| Export uživatelů (CSV/Excel) | ✅ | CSV export s BOM pro Excel |
| Fotogalerie třídy | ❌ | |
| Hromadný import z XML (Bakaláři formát) | ❌ | |

---

## 6. Kurikulum a vzdělávací plány

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| CRUD školních roků | ✅ | Název, datum, aktuální rok |
| Správa semestrů (pololetí) | ✅ | Propojení s akademickým rokem |
| CRUD ročníků (grade levels) | ✅ | |
| CRUD instancí předmětů | ✅ | Přiřazení k ročníku, roku, hodinová dotace |
| Správa učitelských úvazků | ✅ | |
| Verzování ŠVP | ✅ | CRUD, duplikace, porovnání verzí |
| Definice záznamů ŠVP (entries) | ✅ | Přiřazení předmětů k ročníkům v rámci verze |
| Import RVP | ✅ | Upload a potvrzení |
| Zápis studentů do ročníků | ✅ | Hromadný enrollement |
| Tematické plány | ✅ | Rozpis učiva po hodinách/týdnech |
| Přípravy na hodiny | ✅ | CRUD s průběhem, cíli, reflexí |
| Elektronické učebnice / materiály | ✅ | URL-based, typ badge, filtrování |
| Výstupy dle RVP – mapování kompetencí | ✅ | Matice předmět × ročník, click-to-toggle |

---

## 7. Rozvrh

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Definice časových slotů | ✅ | Začátek a konec hodin |
| CRUD rozvrhových událostí | ✅ | Jednotlivě i hromadně (bulk) |
| Validace kolizí | ✅ | Kontrola překryvů učitel/třída/místnost |
| Zobrazení rozvrhu třídy | ✅ | |
| Zobrazení rozvrhu učitele | ✅ | |
| Zobrazení rozvrhu studenta | ✅ | |
| CRUD suplování | ✅ | |
| Vizuální plánovač rozvrhu | ✅ | Drag & drop rozhraní |
| Filtr dle školního roku a semestru | ✅ | |
| Automatické generování rozvrhu | ✅ | Greedy constraint-based algoritmus (třída→ročník→předmět) |
| Tisk rozvrhu | ✅ | HTML export s CSS print styles |
| Zobrazení změn (diff) rozvrhu | ✅ | Snapshoty + barevné porovnání (přidáno/odebráno/změněno) |
| Zvonění / časový harmonogram | ✅ | Label, přestávky, vizuální timeline, samostatná stránka |
| Opakující se události (kroužky) | ✅ | CRUD s přiřazením místnosti a vedoucího, pohled dle dne |
| Sdílení místností mezi třídami | ✅ | Přes kolizní validaci |

---

## 8. Klasifikace a hodnocení

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| CRUD známek | ✅ | Hodnota, váha, popis, datum |
| Zobrazení známek dle třídy | ✅ | |
| Zobrazení známek dle studenta | ✅ | |
| Výpočet vážených průměrů | ✅ | |
| Vysvědčení (report cards) | ✅ | Upsert per student/semestr |
| AI polish slovního hodnocení | ✅ | Automatické vylepšení textu |
| Typy hodnocení dle třídy | ✅ | |
| Slovní hodnocení | ✅ | Součást vysvědčení |
| Zobrazení známek pro studenta (self) | ✅ | Student vidí vlastní známky |
| Zobrazení známek pro rodiče | ✅ | Rodič vidí známky dětí |
| Chování (hodnocení chování) | ✅ | BehaviorGrade model, upsert per student/semestr |
| Hodnocení dle kompetencí (formativní) | ✅ | CompetencyGrade matice student × kompetence |
| Výchovná opatření (pochvaly, důtky) | ✅ | CRUD, typy: pochvala/důtka/důtka TU/důtka ŘŠ, stránka |
| Grafické zobrazení vývoje známek | ✅ | API pro historii známek, graf po čase |
| Export vysvědčení do PDF | ✅ | HTML tabulka s CSS print styles |
| Komisionální přezkoušení | ✅ | CRUD, sledování původní a nové známky |
| Uzavření klasifikace (deadline) | ✅ | Deadline + zámek, upsert per semestr |

---

## 9. Docházka

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Záznam docházky (přítomen, nepřítomen, pozdní, omluven) | ✅ | |
| Sumář docházky za období | ✅ | Přes MCP analytiku |
| Docházka per hodina | ✅ | lessonNumber per záznam, napojeno na UI stránku |
| Omlouvání absence rodičem | ✅ | AbsenceExcuse model, review workflow |
| Automatické upozornění při absenci | ✅ | Notifikace rodičům přes ParentStudent |
| Statistiky docházky třídy | ✅ | Agregáty per student, tabulka |
| Export docházky | ✅ | CSV export s BOM |
| Neomluvené hodiny – eskalace | ✅ | Alert pro studenty nad prahem |

---

## 10. Komunikace

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Přímé konverzace (1:1) | ✅ | |
| Hromadná zpráva třídě | ✅ | Pro učitele a vedení |
| Hromadná zpráva škole | ✅ | Pro vedení školy |
| Notifikace (in-app) | ✅ | Počítadlo nepřečtených |
| Označení notifikací jako přečtených | ✅ | Jednotlivě i hromadně |
| E-mailové notifikace | ✅ | Zapnutí/vypnutí per uživatel |
| Vyhledávání příjemců | ✅ | |
| Skupinové konverzace | ✅ | Více účastníků, typ GROUP |
| Přílohy ve zprávách | ✅ | MessageAttachment + AI moderace (Gemini text + MIME whitelist) |
| Nástěnka / oznámení školy | ✅ | BulletinPost, připínání |
| Ankety a dotazníky | ✅ | Poll + PollOption + PollVote, multi-select |
| Kalendář událostí s RSVP | ✅ | CalendarEvent + EventRsvp (YES/NO/MAYBE) |

---

## 11. Třídní kniha

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| White Book – zobrazení | ✅ | Základní zobrazení dat |
| Elektronická třídní kniha | ✅ | ClassBookEntry + ScheduleEvent link |
| Zápis probíraného učiva | ✅ | Inline editace, auto-prefill z rozvrhu |
| Zápis poznámek k hodině | ✅ | Poznámky + počet nepřítomných |
| Propojení s rozvrhem a docházkou | ✅ | Automatické předvyplnění z ScheduleEvent |
| Podpis učitele (elektronický) | ✅ | TeacherSignature s IP + timestamp |
| Tisk třídní knihy | ✅ | HTML export s rozsahem dat |

---

## 12. AI funkce

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Konverzační AI chat | ✅ | Streaming odpovědí |
| AI polish slovního hodnocení | ✅ | Automatické vylepšení textu |
| Seedování dat pomocí AI | ✅ | Generování testovacích dat |
| Výběr AI poskytovatele | ✅ | OpenAI, Anthropic apod. |
| AI generování tematických plánů | ✅ | Gemini generuje markdown tabulku |
| AI doporučení pro studenty | ✅ | Na základě známek, docházky, chování |
| AI generování slovního hodnocení | ✅ | Funkce refineText u formulářového pole |
| AI analýza prospěchu třídy | ✅ | Statistiky + doporučení pro učitele |
| AI generování testů | ✅ | Otázky s odpověďmi a body |
| AI generování písemek | ✅ | Varianty s klasifikační tabulkou |
| AI detekce škodlivého obsahu | ✅ | Gemini moderace ve zprávách |

---

## 13. Programatický přístup (MCP)

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| MCP server pro AI agenty | ✅ | 36 nástrojů |
| Analytika (docházka, prospěch) | ✅ | 2 nástroje |
| Kurikulum (šk. roky, předměty, zápisy) | ✅ | 8 nástrojů |
| Klasifikace a docházka | ✅ | 3 nástroje |
| Správa (školy, místnosti) | ✅ | 4 nástroje |
| Seeding (generování dat) | ✅ | 4 nástroje |
| Uživatelé a školy | ✅ | 15 nástrojů |
| REST API pro externí integrace | ✅ | OpenAPI/Swagger na /api/docs, 17 tagů |
| Webhooky | ❌ | Notifikace o změnách pro ext. systémy |
| CSV/XML/JSON export dat | ✅ | 5 entit × 3 formáty |

---

## 14. Reporty a výstupy

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Dashboard se statistikami | ✅ | Systémový i školní |
| Audit log | ✅ | |
| AI spotřeba | ✅ | |
| Export vysvědčení do PDF | ✅ | HTML export vysvědčení třídy |
| Tisk rozvrhu | ✅ | HTML export rozvrhu třídy |
| Statistiky prospěchu (třídy, ročníky) | ✅ | Průměr, medián, distribuce, úspěšnost |
| Statistiky docházky | ✅ | API + per-student breakdown |
| Výkazy pro ČŠI | ✅ | JSON + tisknutelné HTML |
| Výkazy pro MŠMT | ✅ | JSON + tisknutelné HTML |
| Export dat do tabulkového formátu | ✅ | CSV/XML/JSON (ExportModule) |

---

## 15. Infrastruktura a provoz

| Funkce | Stav | Poznámka |
|--------|:----:|----------|
| Docker deployment | ✅ | docker-compose |
| PostgreSQL databáze | ✅ | Via Prisma ORM |
| Responsivní webové rozhraní | ✅ | React s mobilním layoutem |
| Lokalizace (CZ/EN) | ✅ | Přepínání jazyku |
| Dark mode | ✅ | ThemeToggle (light/dark/system) |
| PWA (Progressive Web App) | ✅ | manifest.json + Service Worker |
| Automatické zálohy | ✅ | AUTO_BACKUP cron každý den 2:00 |
| Rate limiting | ✅ | Globální ThrottlerGuard + zámek účtů |
| GDPR nástroje | ✅ | Export + anonymizace osobních dat |
| Mobilní aplikace | ❌ | iOS / Android |

---

## 16. Souhrnná tabulka

| Oblast | Celkem funkcí | ✅ Implementováno | 🔶 Částečně | ❌ Chybí |
|--------|:---:|:---:|:---:|:---:|
| Autentizace a identity | 17 | 15 | 0 | 2 |
| Správa systému | 12 | 12 | 0 | 0 |
| Správa školy | 10 | 7 | 1 | 2 |
| Správa uživatelů | 17 | 11 | 3 | 3 |
| Kurikulum | 13 | 9 | 0 | 4 |
| Rozvrh | 15 | 15 | 0 | 0 |
| Klasifikace | 17 | 17 | 0 | 0 |
| Docházka | 8 | 8 | 0 | 0 |
| Komunikace | 12 | 12 | 0 | 0 |
| Třídní kniha | 7 | 7 | 0 | 0 |
| AI funkce | 11 | 11 | 0 | 0 |
| MCP | 10 | 9 | 0 | 1 |
| Reporty a výstupy | 10 | 10 | 0 | 0 |
| Infrastruktura | 10 | 9 | 0 | 1 |
| **Celkem** | **169** | **151** | **4** | **14** |

**Pokrytí:** přibližně **94 %** požadovaných funkcí je plně nebo částečně implementováno.
