---
description: Plan for simplifying school selection and navigation logic
---

# Plán zjednodušení navigace výběru školy

## Analýza problému

Aktuálně existují **3 duplicitní cesty** jak vstoupit do školy:

| # | Kde | Jak | Kam vede |
|---|-----|-----|----------|
| 1 | Sidebar → „Vstoupit do školy" | Naviguje na `/select-school` | `SelectSchool.tsx` — fullscreen stránka s kartami škol |
| 2 | System Admin → Školy (tabulka) | Dropdown „Vstoupit → role" na řádku | `SystemAdminSchools.tsx` — inline `selectSchool()` + navigate |
| 3 | V kontextu školy → header sidebar | Tlačítka „Změnit školu" a „Systém" | `handleLeaveSchool()` → `/select-school`, resp. `leaveSchool()` → `/dashboard` |

### Problémy:
1. **Duplikace** — „Vstoupit do školy" v menu i tabulka škol mají stejnou funkci (vstup do školy)
2. **Matoucí tlačítka** — „Změnit školu" a „Systém" vedou de facto na stejné místo (admin sekce bez school contextu)
3. **`/select-school` vs admin tabulka** — admin vidí školy na dvou místech se stejnou funkcionalitou ale jiným UI
4. **Non-admin bez školy** — uvidí jen prompt v sidebaru bez jasného call-to-action

---

## Cílový stav

### Pravidla navigace:

| Uživatel | Po přihlášení | Výběr školy |
|----------|---------------|-------------|
| **Non-admin, 1 škola** | Auto-select → `/dashboard` | Není vidět „Změnit školu" |
| **Non-admin, N škol** | → `/select-school` | V sidebaru „Změnit školu" → `/select-school` |
| **System admin, bez school ctx** | → `/dashboard` (admin dashboard) | V sidebaru „Vstoupit do školy" → používá tabulku v `SystemAdminSchools` (NE `/select-school`) |
| **System admin, v school ctx** | V school dashboard | Sidebar: „← Zpět na správu" (jedno tlačítko místo dvou) |

### Klíčové změny:

1. **Odstranit duplikátní sidebar link** „Vstoupit do školy" pro system admina — vstup je přes tabulku ve „Školy"
2. **Sloučit „Změnit školu" + „Systém"** do jednoho tlačítka „← Zpět na správu" (pro admina)
3. **Non-admin s více školami** — „Změnit školu" zůstane a vede na `/select-school`
4. **`/select-school`** slouží POUZE pro non-adminy (nebo pokud admin přijde přes URL přímo)

---

## Implementační kroky

### Krok 1: Sidebar — sjednocení headeru (Změnit školu + Systém)
**Soubor:** `apps/frontend/src/components/layout/Sidebar.tsx`

**Změna:** V sekci school header (řádky 174–201) nahradit dva tlačítka jedním:

- **System admin v school ctx:** Jedno tlačítko `← Zpět na správu` → `leaveSchool()` + `navigate('/dashboard')`
- **Non-admin s více školami:** Jedno tlačítko `← Změnit školu` → `handleLeaveSchool()` (navigate `/select-school`)
- **Non-admin s 1 školou:** Žádné tlačítko (nemá kam přepnout)

```tsx
{hasSchoolContext && currentSchool && (
  <div className="mt-3 space-y-2">
    <div className="flex items-center gap-2">
      <Building2 size={14} className="text-muted-foreground shrink-0" />
      <span className="text-sm font-medium truncate">{currentSchool.name}</span>
    </div>
    {isSystemAdmin ? (
      <Button variant="outline" size="sm" className="h-7 w-full text-xs"
        onClick={async () => { await leaveSchool(); navigate('/dashboard'); }}>
        <ArrowLeft size={12} className="mr-1" />
        Zpět na správu systému
      </Button>
    ) : canSwitchSchool ? (
      <Button variant="outline" size="sm" className="h-7 w-full text-xs"
        onClick={handleLeaveSchool}>
        <ArrowLeft size={12} className="mr-1" />
        Změnit školu
      </Button>
    ) : null}
  </div>
)}
```

### Krok 2: Sidebar — odstranit „Vstoupit do školy" z admin navigace
**Soubor:** `apps/frontend/src/components/layout/Sidebar.tsx`

**Změna:** V system admin menu (řádek 241) odstranit:
```tsx
// ODSTRANIT tento řádek:
<SidebarNavItem to="/select-school" icon={Building2} label="Vstoupit do školy" collapsed={collapsed} />
```

Admin vstupuje do školy přes záložku „Školy" v tabulce. Duplicitní odkaz na `/select-school` je matoucí.

### Krok 3: `/select-school` — podmíněný redirect pro admina
**Soubor:** `apps/frontend/src/pages/SelectSchool.tsx`

**Změna:** Pokud je uživatel `isSystemAdmin`, přesměrovat na `/system/schools` místo zobrazení select-school stránky. Admin vždy vstupuje přes tabulku.

```tsx
useEffect(() => {
  if (isSystemAdmin) {
    navigate('/system/schools', { replace: true });
    return;
  }
}, [isSystemAdmin]);
```

To zajistí, že pokud admin omylem přijde na `/select-school` (např. starým bookmarkem), bude přesměrován do správné sekce.

### Krok 4: Non-admin prompt v sidebaru — lépe viditelný
**Soubor:** `apps/frontend/src/components/layout/Sidebar.tsx`

**Změna:** Zachovat stávající prompt pro non-admina bez school contextu (řádky 327–337). Ten je aktuálně OK — zobrazuje text + tlačítko „Vybrat školu".

### Krok 5: Auto-redirect non-admin s 1 školou
**Soubor:** `apps/frontend/src/pages/SelectSchool.tsx`

**Potvrdit:** Toto už funguje (řádek 74–77). Non-admin s jednou školou je automaticky přesměrován.

### Krok 6: `SelectSchool` — odstranit admin-specific UI
**Soubor:** `apps/frontend/src/pages/SelectSchool.tsx`

**Změna:** Odstranit admin-specific části:
- Role-based buttons (Vstoupit jako Ředitel/Zástupce/Správce) — řádky 225–254
- „Vytvořit další školu" — řádky 271–279
- „Přejít do správy systému" — řádky 276–278, 282–288

Tyto funkce jsou duplicitní s `SystemAdminSchools`. Stránka `SelectSchool` bude sloužit POUZE non-adminům.

---

## Shrnutí finálního chování

```
Přihlášení
├─ System Admin
│   ├─ → /dashboard (admin dashboard bez school ctx)
│   ├─ Sidebar: Nástěnka, [Školy, Uživatelé, Nastavení systému]
│   ├─ V tabulce Školy: Vstoupit (dropdown s rolemi)
│   └─ Po vstupu do školy:
│       ├─ Sidebar: school menu + „← Zpět na správu"
│       └─ Klik → leaveSchool + /dashboard
│
├─ Non-admin, 1 škola
│   ├─ Auto-select → /dashboard (school dashboard)
│   └─ Sidebar: school menu (bez tlačítka Změnit)
│
└─ Non-admin, N škol
    ├─ → /select-school (karty škol, jednoduché)
    └─ Po vstupu do školy:
        ├─ Sidebar: school menu + „← Změnit školu"
        └─ Klik → /select-school
```
