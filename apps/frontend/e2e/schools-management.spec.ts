import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin, logout, loginViaHelper } from './helpers';

test.describe('Schools Management & Multi-role Login', () => {
    const TEST_SCHOOL_NAME = 'E2E Testing School ' + Date.now();
    const PRINCIPAL_EMAIL = `principal.${Date.now()}@test.skola.cz`;

    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('Create, Edit and Manage School', async ({ page }) => {
        // 1. Create School
        await page.getByTestId('sidebar-schools').click();
        
        await page.getByTestId('create-school-btn').click();

        await page.fill('input[placeholder*="Základní škola"]', TEST_SCHOOL_NAME);
        await page.fill('input[name="address"]', 'Test Street 123, Testing City');

        // Choose "Create New User" for principal
        await page.getByRole('tab', { name: /Create New User|Vytvořit nového uživatele/i }).click();
        await page.fill('input[name="principalFirstName"]', 'John');
        await page.fill('input[name="principalLastName"]', 'Principal');
        await page.fill('input[name="principalEmail"]', PRINCIPAL_EMAIL);

        await page.getByRole('button', { name: /Create School|Vytvořit školu/i }).click();

        await expect(page.getByText(TEST_SCHOOL_NAME)).toBeVisible();

        // 2. Edit School
        const schoolRow = page.locator('tr', { hasText: TEST_SCHOOL_NAME });
        await schoolRow.getByRole('button', { name: /Edit settings|Upravit nastavení/i }).click();

        await page.fill('input[name="name"]', TEST_SCHOOL_NAME + ' UPDATED');
        await page.getByRole('button', { name: /Save Changes|Uložit změny/i }).click();

        await expect(page.getByText('School updated successfully')).toBeVisible();
        await expect(page.getByText(TEST_SCHOOL_NAME + ' UPDATED')).toBeVisible();

        // 3. Delete School
        await schoolRow.getByRole('button', { name: /Delete|Smazat/i }).click();
        await page.getByRole('button', { name: /Confirm|Potvrdit/i }).click();

        await expect(page.getByText('School deleted successfully')).toBeVisible();
        await expect(page.getByText(TEST_SCHOOL_NAME + ' UPDATED')).not.toBeVisible();
    });

    test('Login as all roles to a school', async ({ page }) => {
        // Using existing demo school "Základní škola T. G. Masaryka" for stability
        const DEMO_SCHOOL = 'Základní škola T. G. Masaryka';

        const roles = [
            { email: 'reditel@skola.test', label: 'PRINCIPAL' },
            { email: 'zastupce@skola.test', label: 'DEPUTY' },
            { email: 'jana.novakova@skola.test', label: 'TEACHER' },
            { email: 'adam.novotn@zak.skola.test', label: 'STUDENT' },
            { email: 'rodi@test.cz', label: 'PARENT' },
        ];

        for (const role of roles) {
            await logout(page);
            await loginViaHelper(page, role.email);

            // Wait for dashboard and verify role-specific elements or just general success
            await expect(page).toHaveURL(/.*dashboard/);
            await expect(page.getByRole('button', { name: /Logout|Odhlásit/i })).toBeVisible();

            // Additional verification based on role can be added here
            console.log(`Successfully logged in as ${role.label}`);
        }
    });
});
