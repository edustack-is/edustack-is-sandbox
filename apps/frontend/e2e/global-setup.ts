/**
 * One-shot login per demo role, executed before the worker pool starts.
 *
 * Why this exists: /api/auth/login is throttled to 5 requests / IP / minute.
 * A parallel-worker run would burst many more than that during setup and
 * fail with 429s. We use the API context once here, swap to a TENANT
 * cookie for non-sysadmin roles, and persist each role's storage state to
 * disk. Tests load the right file via `test.use({ storageState })`.
 */
import { request as playwrightRequest, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEMO_PASSWORD = 'Demo1234!';
const ROLES = ['SYSTEM_ADMIN', 'PRINCIPAL', 'DEPUTY', 'TEACHER', 'STUDENT', 'PARENT'] as const;

interface DemoUser {
    email: string;
    memberships: Array<{ schoolName: string; role: string }>;
}

export default async function globalSetup(_config: FullConfig) {
    const baseURL = 'http://localhost:5173';
    const authDir = path.join(__dirname, '.auth');
    fs.mkdirSync(authDir, { recursive: true });

    // Pull the seeded helper list once and dispose; we re-create dedicated
    // API contexts per role below so each role's storageState is clean.
    const probe = await playwrightRequest.newContext({ baseURL });
    const helperRes = await probe.get('/api/auth/login-helper-users');
    if (!helperRes.ok()) {
        throw new Error(
            `globalSetup: cannot reach ${baseURL}/api/auth/login-helper-users (${helperRes.status()}). ` +
                `Is the dev server running?`,
        );
    }
    const users: DemoUser[] = await helperRes.json();
    await probe.dispose();

    for (const role of ROLES) {
        const user = users.find((u) => u.memberships.some((m) => m.role === role));
        if (!user) {
            console.warn(`globalSetup: skipping ${role} — no demo user found`);
            continue;
        }

        const api = await playwrightRequest.newContext({ baseURL });

        // /api/auth/login is throttled to 5 / IP / 60s. Retry on 429 with a
        // full-window sleep so a partially-used quota from a recent run
        // doesn't blow up setup.
        let login = await api.post('/api/auth/login', {
            data: { email: user.email, password: DEMO_PASSWORD },
        });
        if (login.status() === 429) {
            console.log(`globalSetup: 429 on ${role}, waiting 61s for throttle window to reset`);
            await new Promise((r) => setTimeout(r, 61_000));
            login = await api.post('/api/auth/login', {
                data: { email: user.email, password: DEMO_PASSWORD },
            });
        }
        if (!login.ok()) {
            throw new Error(`globalSetup: login failed for ${role} (${user.email}): ${login.status()}`);
        }

        if (role !== 'SYSTEM_ADMIN') {
            // Swap GLOBAL token for TENANT so /school/* routes work without
            // a UI-side select-school detour.
            const schoolsRes = await api.get('/api/auth/schools');
            const schools = await schoolsRes.json();
            if (!Array.isArray(schools) || schools.length === 0) {
                throw new Error(`globalSetup: no schools for ${role}`);
            }
            const schoolId = schools[0].schoolId || schools[0].school?.id;
            const select = await api.post(`/api/auth/select-school/${schoolId}?role=${role}`);
            if (!select.ok()) {
                throw new Error(`globalSetup: select-school failed for ${role}: ${select.status()}`);
            }
        }

        const statePath = path.join(authDir, `${role}.json`);
        await api.storageState({ path: statePath });
        await api.dispose();
        console.log(`globalSetup: wrote ${statePath}`);
    }
}

export const STORAGE_STATE_FOR = (role: string) => path.join(__dirname, '.auth', `${role}.json`);
