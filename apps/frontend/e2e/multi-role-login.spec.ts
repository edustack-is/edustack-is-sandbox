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
            page.on('console', (msg) => console.log(`BROWSER CONSOLE [${role.name}]: ${msg.text()}`));

            // Go to home first to set localStorage, then to login
            await page.goto('http://127.0.0.1:5173/');
            await page.evaluate(() => localStorage.setItem('ENABLE_LOGIN_HELPER', 'true'));
            await page.goto('http://127.0.0.1:5173/login');

            // Find the helper button
            const userButton = page.locator('button').filter({ hasText: role.email }).first();
            await expect(userButton).toBeVisible({ timeout: 20000 });
            await userButton.click();

            // School selection might appear if not auto-redirected
            try {
                await page.waitForURL(
                    (url) =>
                        url.pathname.includes('/select-school') ||
                        url.pathname.includes('/dashboard') ||
                        url.pathname.includes('/system/'),
                    { timeout: 10000 },
                );

                if (page.url().includes('/select-school')) {
                    // Check if there are schools listed
                    const enterButton = page.locator('button >> text=/Vstoupit|Enter/i').first();
                    if (await enterButton.isVisible({ timeout: 5000 })) {
                        await enterButton.click();
                    }
                }
            } catch (e) {
                console.log('Did not reach school selection or dashboard in time');
            }

            // Redirection to dashboard or system admin
            await page.waitForURL(
                (url) => !url.pathname.includes('/login') && !url.pathname.includes('/select-school'),
                { timeout: 30000 },
            );

            // Check for navigation sidebar
            await expect(page.locator('nav')).toBeVisible({ timeout: 15000 });

            // Logout
            const logoutButton = page.getByRole('button', { name: /Logout|Odhlásit/i });
            await expect(logoutButton).toBeVisible({ timeout: 15000 });
            await logoutButton.click();

            await expect(page).toHaveURL(/.*\/login/);
        });
    }
});
