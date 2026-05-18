import { test, expect, request as playwrightRequest, APIRequestContext } from '@playwright/test';

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
        classrooms: (await csRes.json()) as Array<{ id: string; name: string }>,
        teachers: (await teachersRes.json()) as Array<{
            id: string; // User.id
            firstName?: string;
            lastName?: string;
            teacherProfile: { id: string } | null;
        }>,
    };
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
});
