import { Page, expect } from '@playwright/test';

export async function loginAs(page: Page, email: string) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill credentials
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Demo1234!');

    // Click login button
    await page.getByRole('button', { name: /Login|Přihlásit/i }).click();

    // Wait for navigation away from login to dashboard or school selection
    await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname === '/select-school', {
        timeout: 15000,
    });
    await page.waitForLoadState('networkidle');

    // If we land on select-school, just stay there or navigate to dashboard if we expect it
    if (page.url().includes('/select-school')) {
        // For system admin, we usually want dashboard
        if (email === 'admin@demo.test') {
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
        }
    }
}

export async function loginAsSystemAdmin(page: Page) {
    // Global admin is NOT in the Quick Login helper list (that's only for school-specific members)
    await loginAs(page, 'admin@demo.test');
}

export async function logout(page: Page) {
    await page
        .getByRole('button', { name: /Logout|Odhlásit/i })
        .first()
        .click();
    await page.waitForURL((url) => url.pathname.includes('/login'));
}

export async function switchLanguage(page: Page, lang: 'CZ' | 'EN') {
    // The language switcher has emoji flags, match by text within the button specifically
    const langBtn = page.locator('button').filter({ hasText: new RegExp(`^.*${lang}$`) });
    await langBtn.click();
}

export async function selectSchool(page: Page, schoolName: string, role?: string) {
    await page.goto('/select-school');
    const schoolCard = page
        .locator('div.card', { hasText: schoolName })
        .or(page.locator('div', { hasText: schoolName }));

    if (role) {
        await schoolCard
            .getByRole('button', { name: new RegExp(`Enter as ${role}|Vstoupit jako ${role}`, 'i') })
            .click();
    } else {
        await schoolCard
            .getByRole('button', { name: /Enter|Vstoupit/i })
            .first()
            .click();
    }

    await page.waitForURL((url) => url.pathname === '/dashboard');
}

export async function loginViaHelper(page: Page, email: string) {
    await page.goto('/login');
    // Find the button in Quick Login section
    const helperBtn = page.getByRole('button', { name: email, exact: false });
    await helperBtn.click();

    // Wait for the URL to change and for a key element that indicates the app is loaded
    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 });
    await expect(page.getByRole('button', { name: /Logout|Odhlásit/i }).first()).toBeVisible({ timeout: 10000 });
}
