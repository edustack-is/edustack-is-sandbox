import { test, expect } from '@playwright/test';

test.describe('Multi-role Login via Helper', () => {
    const roles = [
        { name: 'SYSTEM_ADMIN', email: 'admin@demo.test', fullName: 'Admin Demo' },
        { name: 'PRINCIPAL', email: 'horak@skola.test', fullName: 'David Horák' },
        { name: 'DEPUTY', email: 'novakova@skola.test', fullName: 'Jana Nováková' },
        { name: 'TEACHER', email: 'svoboda@skola.test', fullName: 'Petr Svoboda' },
        { name: 'STUDENT', email: 'adam.novotn@zak.skola.test', fullName: 'Adam Novotný' },
    ];

    for (const role of roles) {
        test(`Login as ${role.name}`, async ({ page }) => {
            page.on('console', msg => console.log(`BROWSER CONSOLE [${role.name}]: ${msg.text()}`));
            
            // Go to home first to set localStorage, then to login
            await page.goto('http://127.0.0.1:5173/');
            await page.evaluate(() => localStorage.setItem('ENABLE_LOGIN_HELPER', 'true'));
            await page.goto('http://127.0.0.1:5173/login');

            // Find the helper button
            const userButton = page.locator('button').filter({ hasText: role.email }).first();
            await expect(userButton).toBeVisible({ timeout: 20000 });
            await userButton.click();

            // School selection might appear
            await page.waitForTimeout(2000);
            if (page.url().includes('/select-school')) {
                // Click the first "Vstoupit" (Enter) button
                await page.locator('button >> text=/Vstoupit|Enter/i').first().click();
            }

            // Redirection to dashboard
            await page.waitForURL(url => !url.pathname.includes('/login') && !url.pathname.includes('/select-school'), { timeout: 30000 });
            
            // Check for navigation sidebar
            await expect(page.locator('nav')).toBeVisible({ timeout: 15000 });
            
            // Logout
            await page.locator('nav button').last().click(); // Open profile menu
            await page.locator('button').filter({ hasText: /Logout|Odhlásit/i }).first().click();
            
            await expect(page).toHaveURL(/.*\/login/);
        });
    }
});
