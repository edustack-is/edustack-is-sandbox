import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: './e2e',
    // Login once per role across the suite — /api/auth/login is throttled.
    globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Maximum time one test can run for. */
    timeout: 60 * 1000,
    expect: {
        timeout: 10000,
    },
    /* Retry on CI only — local runs already get a clean retry through the
       smoke suite's `expect.poll` loops, but we keep one retry locally
       for the parallel smoke pass which is sensitive to transient
       throttle/load spikes. */
    retries: process.env.CI ? 2 : 1,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:5173',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        actionTimeout: 20000,
        navigationTimeout: 20000,
        launchOptions: {
            slowMo: 100,
        },
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
});
