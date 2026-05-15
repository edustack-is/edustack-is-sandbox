import { test, expect, Page, request as playwrightRequest } from '@playwright/test';

// ─── Test helpers ─────────────────────────────────────────────

interface DeputyCreds {
    email: string;
    schoolId: string;
    tenantToken: string;
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

    // Default seed password.
    const loginRes = await api.post('/api/auth/login', {
        data: { email: deputy.email, password: 'Demo1234!' },
    });
    if (!loginRes.ok()) {
        throw new Error(`Login failed: HTTP ${loginRes.status()} ${await loginRes.text()}`);
    }
    const globalToken = (await loginRes.json()).access_token as string;

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

/** Inject the TENANT token into localStorage before any app code runs. */
async function loginAsDeputy(page: Page, creds: DeputyCreds) {
    await page.addInitScript((token) => {
        try {
            window.localStorage.setItem('access_token', token);
        } catch {
            /* private mode etc. */
        }
    }, creds.tenantToken);
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
function fatalOnly(errors: string[]): string[] {
    return errors.filter(
        (e) =>
            !/Failed to load resource.*40\d|Download the React DevTools|Each child in a list should have a unique/i.test(
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
