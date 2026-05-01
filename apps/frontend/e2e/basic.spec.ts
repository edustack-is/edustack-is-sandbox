import { test, expect } from '@playwright/test';

test.describe('Basic E2E Tests', () => {
    test('should load the frontend app', async ({ page }) => {
        // This test requires the frontend to be running on localhost:5173
        // Run with: npm run dev (in another terminal)
        await page.goto('http://localhost:5173');

        // Check if the page loads (adjust selector based on your app)
        const title = await page.title();
        expect(title).toBeDefined();
    });
});
