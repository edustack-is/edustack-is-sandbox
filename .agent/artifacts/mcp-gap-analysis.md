# MCP Tools – Analýza chybějících částí

**Datum:** 2026-02-14  
**Stav:** Implementační plán

---

## 1. Přehled architektury

```
Prisma Schema (20 modelů)
    ↕
Backend API (NestJS Controllers)  ← role-based guards (Deputy, Teacher, Principal, Admin)
    ↕
MCP Server (Prisma Client direct) ← volán AI asistentem, žádné auth guards
    ↕
AI Chat (Vercel AI SDK)           ← generateText() s tools
```

**Klíčový rozdíl:** MCP tools používají přímý Prisma přístup (bez auth guards),
zatímco Backend API je za role-based guards. MCP tools tedy mohou provádět
jakoukoliv operaci, pokud to AI asistent považuje za oprávněné na základě
system promptu.

---

## 2. Matice pokrytí (stav PŘED implementací)

### Legenda
- ✅ Plně pokryto (CRUD / relevantní operace)
- ⚠️ Částečně pokryto (jen bulk seed nebo jen READ)
- 🔴 Chybí (žádný MCP tool)

| # | Prisma Model | MCP | BE API | FE UI | Priorita |
|---|---|---|---|---|---|
| 1 | School | ✅ | ✅ | ✅ | – |
| 2 | User | ✅ | ✅ | ✅ | – |
| 3 | SchoolMembership | ✅ | ✅ | ✅ | – |
| 4 | ParentStudent | ✅ | ✅ | ✅ | – |
| 5 | StudentProfile | ✅ | ✅ | ✅ | – |
| 6 | TeacherProfile | ✅ | ✅ | ✅ | – |
| 7 | Classroom | ✅ | ✅ | ✅ | – |
| 8 | **SubjectTemplate** | ⚠️ seed | ✅ CRUD | ✅ | **P2** |
| 9 | **AcademicYear** | ⚠️ seed | ✅ POST | ✅ | **P1** |
| 10 | **GradeLevel** | ⚠️ seed | 🔴 | 🔴 | **P2** |
| 11 | **SubjectInstance** | 🔴 | ✅ POST | ✅ | **P1** |
| 12 | **StudentEnrollment** | 🔴 | ✅ POST | ✅ | **P1** |
| 13 | **Grade** | 🔴 | ✅ POST+GET | ✅ | **P1** |
| 14 | **Attendance** | ⚠️ READ | ✅ POST | ⚠️ | **P2** |
| 15 | **ScheduleEvent** | 🔴 | ⚠️ validate | ✅ | **P3** |
| 16 | **Room** | 🔴 | ✅ CRUD | ✅ | **P2** |
| 17 | **TeacherWorkload** | ⚠️ seed | 🔴 | 🔴 | **P3** |
| 18 | AuditLog | N/A read-only | ✅ GET | – | – |
| 19 | Identity | N/A systémové | ✅ | – | – |
| 20 | SystemSettings | N/A | ✅ | ✅ | – |

---

## 3. Detailní popis chybějících MCP tools

### 3.1 Priorita P1 – Kritické pro základní workflow

#### 3.1.1 `create_academic_year`
**Účel:** Vytvoří školní rok (např. "2025/2026") pro danou školu.  
**Proč chybí:** Nyní se dá vytvořit jen bulk přes `seed_school_structure`.  
**Dopad:** AI nemůže vytvořit nový školní rok bez seedování celé struktury.  
**Schema:** `AcademicYear { name, startDate, endDate, isCurrent, schoolId }`  
**BE vzor:** `POST /api/deputy/academic-years`

#### 3.1.2 `create_subject_instance`
**Účel:** Přiřadí předmětovou šablonu ke konkrétnímu ročníku a školnímu roku.  
**Proč chybí:** Žádný existující MCP tool to nepokrývá.  
**Dopad:** AI nemůže sestavit učební plán – nemůže říct "Matematika v 1. ročníku, 4h/týden".  
**Schema:** `SubjectInstance { templateId, academicYearId, gradeLevelId, schoolId, hoursPerWeek }`  
**BE vzor:** `POST /api/deputy/subjects/instances`

#### 3.1.3 `enroll_students`
**Účel:** Hromadně zapíše studenty do ročníku/třídy pro daný školní rok.  
**Proč chybí:** Žádný existující MCP tool to nepokrývá.  
**Dopad:** AI nemůže provést zápis studentů do ročníků.  
**Schema:** `StudentEnrollment { studentId, academicYearId, gradeLevelId, classroomId? }`  
**BE vzor:** `POST /api/deputy/enrollments/batch`

#### 3.1.4 `create_grade` + `list_grades`
**Účel:** Zadání/čtení hodnocení (známky) studenta v předmětu.  
**Proč chybí:** `get_academic_performance` počítá jen průměry, nedokáže zadat novou známku.  
**Dopad:** AI nemůže zadávat známky – klíčová funkce pro učitele.  
**Schema:** `Grade { value, weight, description, schoolId, studentId, subjectInstanceId, teacherId }`  
**BE vzor:** `POST /api/teacher/grades`, `GET /api/grading/average/:studentId/:subjectInstanceId`

### 3.2 Priorita P2 – Důležité pro kompletní správu

#### 3.2.1 `create_subject_template` + `list_subject_templates`
**Účel:** CRUD pro předmětové šablony (Matematika, Český jazyk, ...).  
**Stav:** Seed vytváří hromadně, chybí individuální CRUD.  
**Schema:** `SubjectTemplate { name, code, svpDescription, schoolId }`

#### 3.2.2 `list_grade_levels`
**Účel:** Výpis ročníků školy (1. ročník, Prima, ...).  
**Stav:** Seed vytváří, chybí čtení.  
**Schema:** `GradeLevel { name, levelNumber, schoolId }`

#### 3.2.3 `manage_rooms` (create, list)
**Účel:** Správa učeben/místností.  
**Stav:** BE API kompletní, MCP chybí.  
**Schema:** `Room { name, capacity, isComputerLab, specialEquipment, schoolId }`

#### 3.2.4 `record_attendance`
**Účel:** Záznam docházky studentů.  
**Stav:** MCP umí jen čtení (`get_attendance_summary`), write chybí.  
**Schema:** `Attendance { date, status, note, schoolId, studentId, teacherId }`

### 3.3 Priorita P3 – Nice to have

#### 3.3.1 `create_schedule_event` + `list_schedule`
**Účel:** Tvorba rozvrhu.  
**Schema:** `ScheduleEvent { dayOfWeek, startTime, endTime, schoolId, subjectInstanceId, classroomId, teacherId }`

#### 3.3.2 `manage_teacher_workload`
**Účel:** Nastavení úvazků učitelů pro školní rok.  
**Schema:** `TeacherWorkload { teacherId, academicYearId, workloadPercentage }`

---

## 4. Implementační plán

### Fáze 1: Nový soubor `curriculum.ts` (P1 tools)
Soubor: `apps/mcp-server/src/tools/curriculum.ts`

Tools:
1. `create_academic_year` – vytvoří školní rok
2. `list_academic_years` – výpis školních roků
3. `list_grade_levels` – výpis ročníků
4. `list_subject_templates` – výpis šablon předmětů
5. `create_subject_template` – vytvoří šablonu předmětu
6. `create_subject_instance` – přiřadí předmět k ročníku a roku
7. `list_subject_instances` – výpis instancí předmětů
8. `enroll_students` – hromadný zápis studentů

### Fáze 2: Nový soubor `grading.ts` (P1+P2 tools)
Soubor: `apps/mcp-server/src/tools/grading.ts`

Tools:
1. `create_grade` – zadání známky
2. `list_student_grades` – výpis známek studenta
3. `record_attendance` – záznam docházky

### Fáze 3: Rozšíření `management.ts` (P2 tools)
Tools:
1. `create_room` – vytvoření učebny
2. `list_rooms` – výpis učeben

### Fáze 4: Rozšíření (P3, volitelné)
1. `create_schedule_event` + `list_schedule`
2. `set_teacher_workload`

### Pro každý tool:
- [ ] MCP tool implementace
- [ ] Registrace v `index.ts`
- [ ] Přidání do `TOOL_LABELS` (cs + en locale files)
- [ ] Přidání do `TaskQueuePanel` getToolLabel

---

## 5. Odhad rozsahu

| Fáze | Nové tools | Nové soubory | ~Řádků kódu |
|------|-----------|-------------|-------------|
| 1 | 8 | 1 | ~400 |
| 2 | 3 | 1 | ~200 |
| 3 | 2 | 0 (+existující) | ~80 |
| 4 | 3 | 0 | ~150 |
| **Celkem** | **16** | **2** | **~830** |
