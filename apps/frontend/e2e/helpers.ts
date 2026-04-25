import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string) {
    await page.goto('/');

    // If already logged in, we might see the layout with sidebar
    const isDashboard = await page
        .getByRole('button', { name: /Logout|Odhlásit/i })
        .isVisible({ timeout: 2000 })
        .catch(() => false);
    if (isDashboard) {
        return;
    }

    // Fill credentials
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Demo1234!'); // Fallback to demo pwd

    // Click login button - it usually has type="submit"
    await page.click('button[type="submit"]');

    // Wait for navigation away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => {
        console.log('Navigation after login timed out, current URL:', page.url());
    });

    // Wait for the page to load the dashboard (indicated by sidebar elements)
    await expect(page.getByRole('button', { name: /Logout|Odhlásit/i })).toBeVisible({ timeout: 20000 });
}

export async function loginAsSystemAdmin(page: Page) {
    // Using the known admin credentials
    await loginAs(page, 'admin@demo.test');
}
