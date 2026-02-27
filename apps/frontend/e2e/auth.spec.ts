import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('F001, F006, F008 - Successful login redirects to dashboard', async ({ page }) => {
        await page.goto('/login');

        // Použijeme demo účet (předpokládáme, že DB obsahuje admin@edustack.cz)
        await page.fill('input[type="email"]', 'admin@edustack.cz');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        // Měli bychom být přesměrováni pryč z login stránky a vidět odhlášení (F001, F006 - Role based UI)
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole('button', { name: /Logout|Odhlásit/i })).toBeVisible({ timeout: 10000 });
    });

    test('F001 - Invalid login shows error message', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'spatny@email.cz');
        await page.fill('input[type="password"]', 'spatneheslo');
        await page.click('button[type="submit"]');

        // Zkontrolujeme, že se objeví chyba (toast nebo text)
        await expect(page.getByText(/neplatné|invalid|chyba|nesprávné/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('F001 - Logout clears session and redirects to login', async ({ page }) => {
        // Nejdřív se přihlásíme
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@edustack.cz');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        const logoutBtn = page.getByRole('button', { name: /Logout|Odhlásit/i });
        await expect(logoutBtn).toBeVisible({ timeout: 10000 });

        // Poté se odhlásíme
        await logoutBtn.click();

        // Očekáváme návrat na login
        await expect(page).toHaveURL(/.*login/);
    });
});
