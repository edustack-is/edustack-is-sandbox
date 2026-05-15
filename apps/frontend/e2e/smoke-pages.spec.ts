/**
 * Cross-role page smoke tests.
 *
 * For every demo role we log in *once* (per role, per worker) via the
 * backend API, save the resulting __edu_session cookie, and apply it to
 * each per-test browser context. The UI login form is throttled to 5
 * requests per minute, so reusing the cookie keeps a 6-role × ~20-page
 * suite from rate-limiting itself.
 *
 * What counts as a regression:
 *   - any uncaught JS error on the page
 *   - any 5xx response (4xx is allowed because some endpoints are role-gated
 *     and the page is expected to handle them gracefully)
 *   - the main content area stayed empty (no <main> children rendered)
 *
 * The tests deliberately do not click controls or submit forms; the goal
 * is a cheap, comprehensive net for "did this page even mount" — not
 * behavioural coverage.
 */
import { test as base, expect, Page, ConsoleMessage } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Role = 'SYSTEM_ADMIN' | 'PRINCIPAL' | 'DEPUTY' | 'TEACHER' | 'STUDENT' | 'PARENT';

// Pages every school member sees in the sidebar.
const COMMON_SCHOOL_PAGES = [
    '/dashboard',
    '/schedule',
    '/grading',
    '/attendance',
    '/classbook',
    '/school/white-book',
    '/messages',
    '/community',
    '/profile',
];

// Pages the school-admin accordion exposes (PRINCIPAL / DEPUTY / ADMIN).
const SCHOOL_ADMIN_PAGES = [
    '/school/rooms',
    '/school/events',
    '/school/curriculum',
    '/school/thematic-plans',
    '/school/lesson-preparations',
    '/school/teaching-materials',
    '/school/competency-mapping',
    '/schedule/planner',
    '/schedule/substitutions',
    '/schedule/bell',
    '/schedule/diff',
    '/schedule/recurring-events',
    '/grading/report-cards',
    '/grading/measures',
    '/year-setup',
    '/school/users',
    '/school/audit-log',
];

const SYSTEM_ADMIN_PAGES = ['/system/schools', '/system/users', '/system/settings', '/system/prompts'];

// SYSTEM_ADMIN works in GLOBAL mode by default — system pages first, then a
// representative school page accessed after entering a school.
const PAGES_BY_ROLE: Record<Role, string[]> = {
    SYSTEM_ADMIN: [...SYSTEM_ADMIN_PAGES, '/profile'],
    PRINCIPAL: [...COMMON_SCHOOL_PAGES, ...SCHOOL_ADMIN_PAGES],
    DEPUTY: [...COMMON_SCHOOL_PAGES, ...SCHOOL_ADMIN_PAGES],
    TEACHER: [...COMMON_SCHOOL_PAGES],
    STUDENT: [...COMMON_SCHOOL_PAGES],
    PARENT: [...COMMON_SCHOOL_PAGES],
};

/**
 * Storage state files are produced by e2e/global-setup.ts before workers
 * start. Each role file holds the __edu_session cookie that role would
 * have after a normal login (and select-school, for non-sysadmins).
 */
const storageStateForRole = (role: Role) => path.join(__dirname, '.auth', `${role}.json`);

/**
 * Sinks for the per-page assertions. We collect everything into arrays and
 * inspect them after navigation has settled so we can report all problems
 * at once instead of failing on the first console.error.
 */
interface PageReport {
    jsErrors: string[];
    serverErrors: string[]; // 5xx only
    consoleErrors: string[];
}

function attachCollectors(page: Page): PageReport {
    const report: PageReport = { jsErrors: [], serverErrors: [], consoleErrors: [] };

    page.on('pageerror', (err) => {
        report.jsErrors.push(`${err.name}: ${err.message}`);
    });

    page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // i18n/react-devtools/etc. console.error noise we don't care about.
        if (/Failed to load resource/i.test(text)) return;
        if (/React DevTools/.test(text)) return;
        report.consoleErrors.push(text);
    });

    page.on('response', (resp) => {
        const status = resp.status();
        if (status >= 500 && resp.url().includes('/api/')) {
            report.serverErrors.push(`${status} ${resp.request().method()} ${new URL(resp.url()).pathname}`);
        }
    });

    return report;
}

async function visitAndAssert(page: Page, route: string, report: PageReport) {
    // Reset per-page buffers so we can attribute issues to this route only.
    report.jsErrors.length = 0;
    report.serverErrors.length = 0;
    report.consoleErrors.length = 0;

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // Some pages fire post-mount fetches that keep the network busy briefly.
    // Wait for idle but cap it so dashboards with polling don't stall us.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
        /* polling page — fall through */
    });

    // 1. The router actually mounted the target route.
    expect(new URL(page.url()).pathname, `expected to land on ${route}`).toContain(route.split('?')[0]);

    // 2. <main> rendered something (catches blank-page regressions). A
    //    loading spinner counts — the test only proves the route mounted
    //    and React got past the first paint, not that data finished
    //    loading. We poll with toBeAttached so the assertion retries while
    //    React commits its first render.
    await expect(page.locator('main > *').first(), `<main> had no children on ${route}`).toBeAttached({
        timeout: 10_000,
    });

    // 3. No uncaught JS exceptions.
    expect(report.jsErrors, `JS errors on ${route}`).toEqual([]);

    // 4. No 5xx responses (4xx is acceptable — role-gated endpoints).
    expect(report.serverErrors, `5xx responses on ${route}`).toEqual([]);

    // 5. No console.error logs (i18n / network noise already filtered).
    expect(report.consoleErrors, `console.error on ${route}`).toEqual([]);
}

for (const role of Object.keys(PAGES_BY_ROLE) as Role[]) {
    base.describe(`Smoke / ${role}`, () => {
        base.use({ storageState: storageStateForRole(role) });
        for (const route of PAGES_BY_ROLE[role]) {
            base(`${role} can load ${route}`, async ({ page }) => {
                const report = attachCollectors(page);
                await visitAndAssert(page, route, report);
            });
        }
    });
}
