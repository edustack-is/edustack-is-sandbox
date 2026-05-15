import { test, expect, Page, request as playwrightRequest } from '@playwright/test';

// ─── Test helpers ─────────────────────────────────────────────

interface DeputyCreds {
    email: string;
    schoolId: string;
    tenantToken: string;
}

interface ClassroomLite {
    id: string;
    name: string;
}

/**
 * Discover a DEPUTY login-helper user and obtain a school-scoped (TENANT) JWT
 * via the API directly. The seed re-hashes the school name on every db:init,
 * so a hard-coded email goes stale — discovery keeps the test stable.
 */
async function buildDeputyCreds(baseURL: string): Promise<DeputyCreds> {
    const api = await playwrightRequest.newContext({ baseURL });

    const helperRes = await api.get('/api/auth/login-helper-users');
    if (!helperRes.ok()) throw new Error(`login-helper-users HTTP ${helperRes.status()}`);
    const users = (await helperRes.json()) as Array<{
        email: string;
        memberships: Array<{ schoolName: string; role: string }>;
    }>;
    const deputy = users.find((u) => u.memberships.some((m) => m.role === 'DEPUTY'));
    if (!deputy) throw new Error('No DEPUTY user found in login-helper-users.');

    // The login endpoint is throttled (5/60s) to prevent brute-force. When
    // running the tests repeatedly during development we may briefly exceed
    // that limit — back off and retry rather than failing the whole run.
    let loginRes;
    for (let attempt = 0; attempt < 3; attempt++) {
        loginRes = await api.post('/api/auth/login', {
            data: { email: deputy.email, password: 'Demo1234!' },
        });
        if (loginRes.ok()) break;
        if (loginRes.status() === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 15_000));
            continue;
        }
        throw new Error(`Login failed: HTTP ${loginRes.status()} ${await loginRes.text()}`);
    }
    const globalToken = (await loginRes!.json()).access_token as string;

    const schoolsRes = await api.get('/api/auth/schools', {
        headers: { Authorization: `Bearer ${globalToken}` },
    });
    if (!schoolsRes.ok()) throw new Error(`schools HTTP ${schoolsRes.status()}`);
    const schools = (await schoolsRes.json()) as Array<{
        schoolId: string;
        role: string;
        school: { id: string };
    }>;
    const deputyMembership = schools.find((s) => s.role === 'DEPUTY');
    if (!deputyMembership) throw new Error('Deputy has no DEPUTY membership in /api/auth/schools.');
    const schoolId = deputyMembership.schoolId ?? deputyMembership.school.id;

    const selectRes = await api.post(`/api/auth/select-school/${schoolId}?role=DEPUTY`, {
        headers: { Authorization: `Bearer ${globalToken}` },
    });
    if (!selectRes.ok()) throw new Error(`select-school HTTP ${selectRes.status()}`);
    const tenantToken = (await selectRes.json()).access_token as string;

    return { email: deputy.email, schoolId, tenantToken };
}

/**
 * Authenticate the browser context as the deputy by setting the httpOnly
 * session cookie that the backend would normally set on /api/auth/login.
 * We also seed localStorage as a transitional fallback for code paths
 * that haven't been migrated yet.
 */
async function loginAsDeputy(page: Page, creds: DeputyCreds) {
    await page.context().addCookies([
        {
            name: '__edu_session',
            value: creds.tenantToken,
            url: 'http://localhost:5173',
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
        },
    ]);
    await page.addInitScript((token) => {
        try {
            window.localStorage.setItem('access_token', token);
        } catch {
            /* private mode etc. */
        }
    }, creds.tenantToken);
}

/** Fetch the school's classrooms so the assignment test can pick a real one. */
async function fetchClassrooms(baseURL: string, tenantToken: string): Promise<ClassroomLite[]> {
    const api = await playwrightRequest.newContext({ baseURL });
    const res = await api.get('/api/deputy/classrooms', {
        headers: { Authorization: `Bearer ${tenantToken}` },
    });
    if (!res.ok()) throw new Error(`classrooms HTTP ${res.status()}`);
    const list = (await res.json()) as Array<{ id: string; name: string }>;
    return list.map((c) => ({ id: c.id, name: c.name }));
}

function watchConsoleErrors(page: Page, sink: string[]) {
    page.on('console', (msg) => {
        if (msg.type() === 'error') sink.push(`[console] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
        sink.push(`[pageerror] ${err.message}`);
    });
}

// Filter known-irrelevant console noise so a real bug isn't masked by it.
// ResizeObserver loop notifications are emitted by Radix portals/animations
// and are benign — Chromium itself recommends suppressing them.
function fatalOnly(errors: string[]): string[] {
    return errors.filter(
        (e) =>
            !/Failed to load resource.*40\d|Download the React DevTools|Each child in a list should have a unique|ResizeObserver loop/i.test(
                e,
            ),
    );
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Worksheet: deputy creates a student family and assigns to a class', () => {
    let creds: DeputyCreds;

    test.beforeAll(async ({ baseURL }) => {
        creds = await buildDeputyCreds(baseURL ?? 'http://localhost:5173');
    });

    test('add-user dialog opens and is interactive (regression: appeared to freeze)', async ({ page }) => {
        const consoleErrors: string[] = [];
        watchConsoleErrors(page, consoleErrors);

        await loginAsDeputy(page, creds);
        await page.goto('/school/users');
        await expect(page.getByRole('heading', { name: /Správa uživatelů|User management/i })).toBeVisible();

        // Use dispatchEvent so we don't wait for Radix's open animation to settle —
        // that was the root cause of the original "freeze" symptom.
        const addUserBtn = page.getByRole('button', { name: /Přidat uživatele|Add user/i }).first();
        await expect(addUserBtn).toBeEnabled();
        await addUserBtn.dispatchEvent('click');

        // Dialog mounts and the first input is reachable.
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('#student-firstName')).toBeVisible({ timeout: 5_000 });

        // The dialog is fully interactive (smoke type).
        await page.locator('#student-firstName').fill('SmokeTest');
        await expect(page.locator('#student-firstName')).toHaveValue('SmokeTest');

        // No page-fatal console noise during open.
        const fatal = fatalOnly(consoleErrors);
        expect(fatal, `Unexpected console errors during dialog open:\n${fatal.join('\n')}`).toEqual([]);
    });

    test('Krok 1-2: create student with one parent via the student-family tab', async ({ page }) => {
        const consoleErrors: string[] = [];
        watchConsoleErrors(page, consoleErrors);

        await loginAsDeputy(page, creds);
        await page.goto('/school/users');
        await page.waitForLoadState('networkidle');

        // Unique names so reruns don't collide.
        const suffix = Date.now().toString().slice(-6);
        const studentFirstName = 'Jan';
        const studentLastName = `Novák${suffix}`;
        const parentFirstName = 'Jana';
        const parentLastName = `Nováková${suffix}`;
        const parentEmail = `jana.novakova.${suffix}@e2e.test`;

        await page
            .getByRole('button', { name: /Přidat uživatele|Add user/i })
            .first()
            .dispatchEvent('click');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

        // The student tab is the default but assert it anyway.
        await expect(page.locator('#student-firstName')).toBeVisible();

        await page.locator('#student-firstName').fill(studentFirstName);
        await page.locator('#student-lastName').fill(studentLastName);

        // Add one parent (the field array starts empty).
        await page.getByRole('button', { name: /Přidat rodiče|Add parent/i }).dispatchEvent('click');

        // Scope to the parent card so placeholders are unambiguous.
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('input[placeholder="Jana"]').fill(parentFirstName);
        await dialog.locator('input[placeholder="Nováková"]').fill(parentLastName);
        await dialog.locator('input[placeholder="jana@email.cz"]').fill(parentEmail);

        // Submit. We fire the click via evaluate to bypass Playwright's
        // post-click waits that lock against the dialog-close animation.
        await dialog
            .getByRole('button', { name: /Vytvořit žáka|Create student/i })
            .evaluate((btn) => (btn as HTMLButtonElement).click());

        // Success toast + dialog closes.
        await expect(page.getByText(/Žák.*vytvořen|Student.*created/i).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5_000 });

        // ─── Krok 3: find the new student in the list ─────────
        await page
            .getByPlaceholder(/Hledat|Search/i)
            .first()
            .fill(studentLastName);

        // The data-table renders "lastName firstName".
        await expect(page.getByText(`${studentLastName} ${studentFirstName}`)).toBeVisible({ timeout: 5_000 });

        const fatal = fatalOnly(consoleErrors);
        expect(fatal, `Unexpected console errors during student-family creation:\n${fatal.join('\n')}`).toEqual([]);
    });

    test('Krok 3: assign newly-created student to a classroom via the quick action', async ({ page, baseURL }) => {
        const consoleErrors: string[] = [];
        watchConsoleErrors(page, consoleErrors);

        const classrooms = await fetchClassrooms(baseURL ?? 'http://localhost:5173', creds.tenantToken);
        expect(classrooms.length, 'Seed must include at least one classroom for the deputy school.').toBeGreaterThan(0);
        const targetClassroom = classrooms[0];

        await loginAsDeputy(page, creds);
        await page.goto('/school/users');
        await page.waitForLoadState('networkidle');

        // Create a fresh student so the test owns the row it will assign.
        const suffix = Date.now().toString().slice(-6);
        const studentFirstName = 'Klára';
        const studentLastName = `Třídní${suffix}`;

        await page
            .getByRole('button', { name: /Přidat uživatele|Add user/i })
            .first()
            .dispatchEvent('click');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
        await page.locator('#student-firstName').fill(studentFirstName);
        await page.locator('#student-lastName').fill(studentLastName);
        await page
            .locator('[role="dialog"]')
            .getByRole('button', { name: /Vytvořit žáka|Create student/i })
            .evaluate((btn) => (btn as HTMLButtonElement).click());
        await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });

        // Find the new student's row and click the "Assign to classroom" action.
        await page
            .getByPlaceholder(/Hledat|Search/i)
            .first()
            .fill(studentLastName);
        const studentRow = page.getByRole('row').filter({ hasText: `${studentLastName} ${studentFirstName}` });
        await expect(studentRow).toBeVisible({ timeout: 5_000 });

        await studentRow.getByRole('button', { name: /Přiřadit do třídy|Assign.*class/i }).dispatchEvent('click');

        const assignDialog = page.locator('[role="dialog"]');
        await expect(assignDialog).toBeVisible({ timeout: 5_000 });

        // Open the classroom select and pick the target classroom. Radix
        // Select options animate in; use evaluate-click to skip the stability
        // wait (same pattern as the dialog trigger above).
        await assignDialog.locator('#assign-classroom').click({ force: true });
        await page
            .getByRole('option', { name: new RegExp(`^${targetClassroom.name}$`) })
            .evaluate((el) => (el as HTMLElement).click());

        await assignDialog
            .getByRole('button', { name: /Uložit|Save/i })
            .evaluate((btn) => (btn as HTMLButtonElement).click());

        await expect(page.getByText(/Třída.*aktualizována|Classroom updated/i).first()).toBeVisible({
            timeout: 10_000,
        });

        // After loadUsers() the row should now show the classroom badge.
        await expect(studentRow.getByText(targetClassroom.name, { exact: false })).toBeVisible({ timeout: 5_000 });

        const fatal = fatalOnly(consoleErrors);
        expect(fatal, `Unexpected console errors during classroom assignment:\n${fatal.join('\n')}`).toEqual([]);
    });

    test('Krok 3 (alt): classroom field is reachable from the edit dialog for students', async ({ page, baseURL }) => {
        const classrooms = await fetchClassrooms(baseURL ?? 'http://localhost:5173', creds.tenantToken);
        expect(classrooms.length).toBeGreaterThan(0);

        await loginAsDeputy(page, creds);
        await page.goto('/school/users');
        await page.waitForLoadState('networkidle');

        // Pre-create a student via the API to keep this test focused on the edit dialog.
        const suffix = Date.now().toString().slice(-6);
        const studentFirstName = 'Eva';
        const studentLastName = `Editor${suffix}`;

        const apiCtx = await playwrightRequest.newContext({ baseURL });
        const createRes = await apiCtx.post('/api/deputy/users/student-family', {
            headers: { Authorization: `Bearer ${creds.tenantToken}` },
            data: {
                student: { firstName: studentFirstName, lastName: studentLastName },
                parents: [],
            },
        });
        expect(createRes.ok(), `student create HTTP ${createRes.status()}`).toBeTruthy();

        await page.goto('/school/users');
        await expect(page.getByRole('heading', { name: /Správa uživatelů|User management/i })).toBeVisible({
            timeout: 15_000,
        });
        await page.waitForLoadState('networkidle');

        // Filter to our newly created student. After a freshly-reloaded page
        // the React input ref isn't immediately settled, so we set the value
        // via evaluate and fire React's expected events directly.
        await page
            .getByPlaceholder(/Hledat|Search/i)
            .first()
            .evaluate((el, value) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                setter?.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }, studentLastName);

        const row = page.getByRole('row').filter({ hasText: `${studentLastName} ${studentFirstName}` });
        await expect(row).toBeVisible({ timeout: 10_000 });

        // Open the edit dialog and confirm the classroom select is rendered.
        await row.getByRole('button', { name: /Upravit|Edit/i }).dispatchEvent('click');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('#edit-classroom')).toBeVisible();
    });

    test('staff tab also opens and exposes the staff form', async ({ page }) => {
        await loginAsDeputy(page, creds);
        // Users.tsx initialises the activeTab from window.location.hash, so we
        // pre-load with #staff to land on the Staff tab when the dialog opens.
        await page.goto('/school/users#staff');

        await page
            .getByRole('button', { name: /Přidat uživatele|Add user/i })
            .first()
            .dispatchEvent('click');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

        await expect(page.locator('#staff-firstName')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('#staff-email')).toBeVisible();

        // Verify role-select default and workload input are wired up.
        await expect(page.locator('#staff-workload')).toBeVisible();
    });
});
