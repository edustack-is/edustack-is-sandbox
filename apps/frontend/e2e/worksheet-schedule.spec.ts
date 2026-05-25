import { test, expect, request as playwrightRequest, APIRequestContext, Page } from '@playwright/test';

// ─── Test helpers ─────────────────────────────────────────────

interface DeputyCreds {
    email: string;
    schoolId: string;
    tenantToken: string;
}

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
    const schools = (await schoolsRes.json()) as Array<{
        schoolId: string;
        role: string;
        school: { id: string };
    }>;
    const deputyMembership = schools.find((s) => s.role === 'DEPUTY')!;
    const schoolId = deputyMembership.schoolId ?? deputyMembership.school.id;

    const selectRes = await api.post(`/api/auth/select-school/${schoolId}?role=DEPUTY`, {
        headers: { Authorization: `Bearer ${globalToken}` },
    });
    const tenantToken = (await selectRes.json()).access_token as string;
    return { email: deputy.email, schoolId, tenantToken };
}

function authed(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

async function fetchPrereqs(api: APIRequestContext, token: string) {
    const [aysRes, glsRes, tsRes, csRes, teachersRes] = await Promise.all([
        api.get('/api/deputy/academic-years', authed(token)),
        api.get('/api/deputy/grade-levels', authed(token)),
        api.get('/api/deputy/subjects', authed(token)),
        api.get('/api/deputy/classrooms', authed(token)),
        api.get('/api/deputy/teachers', authed(token)),
    ]);
    for (const [name, res] of [
        ['academic-years', aysRes],
        ['grade-levels', glsRes],
        ['subjects', tsRes],
        ['classrooms', csRes],
        ['teachers', teachersRes],
    ] as const) {
        if (!res.ok()) throw new Error(`${name} HTTP ${res.status()}`);
    }
    return {
        academicYears: (await aysRes.json()) as Array<{ id: string; isCurrent: boolean }>,
        gradeLevels: (await glsRes.json()) as Array<{ id: string; name: string; levelNumber: number }>,
        classrooms: (await csRes.json()) as Array<{ id: string; name: string; grade: number }>,
        teachers: (await teachersRes.json()) as Array<{
            id: string; // User.id
            firstName?: string;
            lastName?: string;
            teacherProfile: { id: string } | null;
        }>,
    };
}

/**
 * Authenticate the browser context as the deputy by setting the httpOnly
 * session cookie we already obtained via the API. Avoids running the
 * login UI form for every UI-level test.
 */
async function loginAsDeputy(page: Page, token: string, baseURL: string) {
    const url = new URL(baseURL);
    await page.context().addCookies([
        {
            name: '__edu_session',
            value: token,
            domain: url.hostname,
            path: '/',
            httpOnly: true,
            secure: url.protocol === 'https:',
            sameSite: 'Lax',
        },
    ]);
}

function teacherProfileId(t: { teacherProfile: { id: string } | null }): string {
    if (!t.teacherProfile) {
        throw new Error('Teacher has no TeacherProfile — seed must include profiles.');
    }
    return t.teacherProfile.id;
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Worksheet 2: schedule conflict — deputy tries to double-book a teacher', () => {
    let creds: DeputyCreds;
    let api: APIRequestContext;

    test.beforeAll(async ({ baseURL }) => {
        creds = await buildDeputyCreds(baseURL ?? 'http://localhost:5173');
        api = await playwrightRequest.newContext({ baseURL });
    });

    test('Kroky 1-4: create subject + instance, schedule it, second attempt with same teacher is rejected', async () => {
        const prereqs = await fetchPrereqs(api, creds.tenantToken);

        // Need a current academic year, at least 2 classrooms (so the "hack"
        // can pick a different one) and at least 1 teacher.
        const academicYear = prereqs.academicYears.find((a) => a.isCurrent) ?? prereqs.academicYears[0];
        expect(academicYear, 'Seed must provide an academic year').toBeDefined();
        expect(prereqs.gradeLevels.length, 'Seed must provide grade levels').toBeGreaterThan(0);
        expect(
            prereqs.classrooms.length,
            'Seed must provide at least 2 classrooms for the conflict test',
        ).toBeGreaterThanOrEqual(2);
        expect(prereqs.teachers.length, 'Seed must provide at least 1 teacher').toBeGreaterThan(0);

        const eighth = prereqs.gradeLevels.find((g) => g.levelNumber === 8) ?? prereqs.gradeLevels[0];
        const teacher = prereqs.teachers.find((t) => t.teacherProfile)!;
        expect(teacher, 'Seed must include at least one teacher with a TeacherProfile').toBeTruthy();
        const [classA, classB] = prereqs.classrooms;

        // ─── Krok 1: create subject template "AI" ──────────────
        const suffix = Date.now().toString().slice(-6);
        const subjectName = `Základy umělé inteligence ${suffix}`;
        const subjectCode = `AI${suffix}`;
        const subjectRes = await api.post('/api/deputy/subjects', {
            ...authed(creds.tenantToken),
            data: { name: subjectName, code: subjectCode },
        });
        expect(subjectRes.ok(), `subject create HTTP ${subjectRes.status()}: ${await subjectRes.text()}`).toBeTruthy();
        const subjectTemplate = (await subjectRes.json()) as { id: string };

        // ─── Krok 2: create instance for 8th grade, 2 h/week ──
        const instanceRes = await api.post('/api/deputy/subjects/instances', {
            ...authed(creds.tenantToken),
            data: {
                templateId: subjectTemplate.id,
                academicYearId: academicYear.id,
                gradeLevelId: eighth.id,
                hoursPerWeek: 2,
            },
        });
        expect(
            instanceRes.ok(),
            `instance create HTTP ${instanceRes.status()}: ${await instanceRes.text()}`,
        ).toBeTruthy();
        const subjectInstance = (await instanceRes.json()) as { id: string };

        // ─── Krok 3: schedule for Monday, lesson 1 ─────────────
        // dayOfWeek: 1 = Monday in this codebase.
        const firstEventRes = await api.post('/api/schedule/events', {
            ...authed(creds.tenantToken),
            data: {
                // Saturday slot 99 — guaranteed empty in the seed, so this
                // test reasons about the collision logic, not seed-day collisions.
                dayOfWeek: 6,
                lessonNumber: 99,
                subjectInstanceId: subjectInstance.id,
                classroomId: classA.id,
                teacherId: teacherProfileId(teacher),
                academicYearId: academicYear.id,
            },
        });
        expect(
            firstEventRes.ok(),
            `first schedule event HTTP ${firstEventRes.status()}: ${await firstEventRes.text()}`,
        ).toBeTruthy();
        const firstEvent = (await firstEventRes.json()) as { id: string };
        expect(firstEvent.id).toBeTruthy();

        // ─── Krok 4: the "hack" — same teacher, same slot, different class ──
        const conflictRes = await api.post('/api/schedule/events', {
            ...authed(creds.tenantToken),
            data: {
                // Saturday slot 99 — guaranteed empty in the seed, so this
                // test reasons about the collision logic, not seed-day collisions.
                dayOfWeek: 6,
                lessonNumber: 99,
                subjectInstanceId: subjectInstance.id,
                classroomId: classB.id,
                teacherId: teacherProfileId(teacher),
                academicYearId: academicYear.id,
            },
        });
        expect(
            conflictRes.status(),
            'Second event with the same teacher in the same slot must be rejected with 409.',
        ).toBe(409);

        const conflictBody = await conflictRes.json();
        const msg = JSON.stringify(conflictBody);
        expect(msg.toLowerCase()).toMatch(/teacher|conflict|kolize|collision/);

        // Cleanup so reruns aren't affected.
        await api.delete(`/api/schedule/events/${firstEvent.id}`, authed(creds.tenantToken));
    });

    test('Bonus: the validate endpoint reports the same collision instead of silently passing', async () => {
        const prereqs = await fetchPrereqs(api, creds.tenantToken);
        const academicYear = prereqs.academicYears.find((a) => a.isCurrent) ?? prereqs.academicYears[0];
        const eighth = prereqs.gradeLevels.find((g) => g.levelNumber === 8) ?? prereqs.gradeLevels[0];
        const teacher = prereqs.teachers.find((t) => t.teacherProfile)!;
        expect(teacher, 'Seed must include at least one teacher with a TeacherProfile').toBeTruthy();
        const [classA, classB] = prereqs.classrooms;

        // Set up a real event so /validate has something to collide with.
        const suffix = Date.now().toString().slice(-6);
        const subjectRes = await api.post('/api/deputy/subjects', {
            ...authed(creds.tenantToken),
            data: { name: `AI validate ${suffix}`, code: `AIV${suffix}` },
        });
        const subjectTemplate = (await subjectRes.json()) as { id: string };
        const instanceRes = await api.post('/api/deputy/subjects/instances', {
            ...authed(creds.tenantToken),
            data: {
                templateId: subjectTemplate.id,
                academicYearId: academicYear.id,
                gradeLevelId: eighth.id,
                hoursPerWeek: 1,
            },
        });
        const subjectInstance = (await instanceRes.json()) as { id: string };
        const eventRes = await api.post('/api/schedule/events', {
            ...authed(creds.tenantToken),
            data: {
                // Different empty slot to avoid colliding with the first test.
                dayOfWeek: 6,
                lessonNumber: 98,
                subjectInstanceId: subjectInstance.id,
                classroomId: classA.id,
                teacherId: teacherProfileId(teacher),
                academicYearId: academicYear.id,
            },
        });
        const event = (await eventRes.json()) as { id: string };

        // Validate the *same* slot the live event occupies — that's the
        // collision we want the endpoint to flag. (The previous probe used
        // Mon/1, but seed data has no events there, so validate correctly
        // returned valid: true and the assertion below failed.)
        const validateRes = await api.post('/api/schedule/validate', {
            ...authed(creds.tenantToken),
            data: {
                dayOfWeek: 6,
                lessonNumber: 98,
                teacherId: teacherProfileId(teacher),
                classroomId: classB.id,
                academicYearId: academicYear.id,
            },
        });
        expect(validateRes.ok()).toBeTruthy();
        const validateBody = (await validateRes.json()) as {
            valid: boolean;
            reason?: string;
        };
        expect(validateBody.valid).toBe(false);
        // Any of teacher/classroom/room reasons would satisfy the contract;
        // we just assert the endpoint no longer silently passes.
        expect(validateBody.reason).toBeTruthy();

        await api.delete(`/api/schedule/events/${event.id}`, authed(creds.tenantToken));
    });

    test('Kroky 1-4 (UI): planner shows a localized Czech toast when the deputy double-books a teacher', async ({
        page,
        baseURL,
    }) => {
        const root = baseURL ?? 'http://localhost:5173';
        const prereqs = await fetchPrereqs(api, creds.tenantToken);
        const academicYear = prereqs.academicYears.find((a) => a.isCurrent) ?? prereqs.academicYears[0];
        expect(prereqs.classrooms.length).toBeGreaterThanOrEqual(2);
        expect(prereqs.teachers.length).toBeGreaterThan(0);

        const teacher = prereqs.teachers.find((t) => t.teacherProfile)!;
        const [classA, classB] = prereqs.classrooms;
        const gradeOfA = prereqs.gradeLevels.find((g) => g.levelNumber === classA.grade);
        const gradeOfB = prereqs.gradeLevels.find((g) => g.levelNumber === classB.grade);
        expect(gradeOfA, 'classA grade must match a GradeLevel').toBeTruthy();
        expect(gradeOfB, 'classB grade must match a GradeLevel').toBeTruthy();

        // Seed populates lessons 1-6 (1-4 on Fri); lesson 7 on Monday is the
        // first slot the bell schedule still renders but no seeded event
        // occupies — perfect target for the UI conflict.
        const dayOfWeek = 1; // Monday
        const lessonNumber = 7;

        // ── Krok 1+2: subject template + instances per grade ────
        const suffix = Date.now().toString().slice(-6);
        const subjectRes = await api.post('/api/deputy/subjects', {
            ...authed(creds.tenantToken),
            data: { name: `AI UI ${suffix}`, code: `AIU${suffix}` },
        });
        expect(subjectRes.ok()).toBeTruthy();
        const subjectTemplate = (await subjectRes.json()) as { id: string };

        async function createInstance(gradeLevelId: string) {
            const r = await api.post('/api/deputy/subjects/instances', {
                ...authed(creds.tenantToken),
                data: {
                    templateId: subjectTemplate.id,
                    academicYearId: academicYear.id,
                    gradeLevelId,
                    hoursPerWeek: 2,
                },
            });
            expect(r.ok()).toBeTruthy();
            return (await r.json()) as { id: string };
        }
        const instanceA = await createInstance(gradeOfA!.id);
        const instanceB = gradeOfA!.id === gradeOfB!.id ? instanceA : await createInstance(gradeOfB!.id);

        // ── Krok 3 (API): pre-create the blocking event so the UI step ──
        // can target the exact same (day, lesson, teacher) and trigger 409.
        const blockingRes = await api.post('/api/schedule/events', {
            ...authed(creds.tenantToken),
            data: {
                dayOfWeek,
                lessonNumber,
                subjectInstanceId: instanceA.id,
                classroomId: classA.id,
                teacherId: teacherProfileId(teacher),
                academicYearId: academicYear.id,
            },
        });
        expect(blockingRes.ok(), `blocking event HTTP ${blockingRes.status()}`).toBeTruthy();
        const blockingEvent = (await blockingRes.json()) as { id: string };

        try {
            // ── Krok 4 (UI): the deputy attempts the hack from the planner.
            await loginAsDeputy(page, creds.tenantToken, root);
            await page.goto('/schedule/planner');
            await expect(page.getByRole('heading', { name: /Plánování rozvrhu/i })).toBeVisible({
                timeout: 10_000,
            });

            // Switch to the second classroom — the grid only shows events the
            // current class is part of, so classB's Mon/7 cell stays empty.
            await page.locator('button[role="combobox"]').first().click();
            await page
                .getByRole('option', { name: new RegExp(`^${classB.name}$`) })
                .evaluate((el) => (el as HTMLElement).click());

            // Click Mon/7 cell. The first <td> in each row is the lesson
            // label; cells for Mon..Fri follow as nth(1)..nth(5).
            const row = page.locator('tr').filter({ hasText: new RegExp(`^${lessonNumber}\\.`) });
            await expect(row.first()).toBeVisible({ timeout: 10_000 });
            await row.first().locator('td').nth(1).click();

            // The "Add lesson" modal opens.
            const dialog = page.locator('[role="dialog"]');
            await expect(dialog.getByText(/Přidat hodinu — Pondělí/)).toBeVisible({ timeout: 5_000 });

            // Subject dropdown is filtered to classB's grade; pick the AI row.
            const selects = dialog.locator('button[role="combobox"]');
            await selects.nth(0).click();
            await page
                .getByRole('option', { name: new RegExp(`AIU${suffix}`) })
                .first()
                .evaluate((el) => (el as HTMLElement).click());

            // Teacher dropdown — pick the same teacher that's already booked.
            await selects.nth(1).click();
            const teacherLabelRegex = new RegExp(`${teacher.lastName ?? '.'} ${teacher.firstName ?? ''}`.trim() || '.');
            await page
                .getByRole('option', { name: teacherLabelRegex })
                .first()
                .evaluate((el) => (el as HTMLElement).click());

            // Submit; expect the localized collision toast.
            await dialog
                .getByRole('button', { name: /^Přidat$/i })
                .evaluate((btn) => (btn as HTMLButtonElement).click());

            await expect(
                page.getByText('Učitel už má v tento čas naplánovanou jinou hodinu.', { exact: false }),
            ).toBeVisible({ timeout: 10_000 });
        } finally {
            await api.delete(`/api/schedule/events/${blockingEvent.id}`, authed(creds.tenantToken));
        }
    });
});
