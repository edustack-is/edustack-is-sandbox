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

        // "Create New User" radio for the principal (Radio, not Tab — Radix renders
        // the option as a generic in the snapshot but a role=radio in the DOM).
        await page.getByRole('radio', { name: /Create New User|Vytvořit nového uživatele/i }).click();

        // The react-hook-form fields are named firstName/lastName/email (the
        // outer school form's `name` field shares the email name, so we scope
        // to the open dialog to avoid the schoolName/address inputs).
        const createDialog = page.getByRole('dialog');
        await createDialog.locator('input[name="firstName"]').fill('John');
        await createDialog.locator('input[name="lastName"]').fill('Principal');
        await createDialog.locator('input[name="email"]').fill(PRINCIPAL_EMAIL);

        await page.getByRole('button', { name: /Create School|Vytvořit školu/i }).click();

        await expect(page.getByText(TEST_SCHOOL_NAME)).toBeVisible();

        // 2. Edit School
        const schoolRow = page.locator('tr', { hasText: TEST_SCHOOL_NAME });
        await schoolRow.getByRole('button', { name: /Edit settings|Upravit nastavení/i }).click();

        const editDialog = page.getByRole('dialog');
        await editDialog.locator('input[name="name"]').fill(TEST_SCHOOL_NAME + ' UPDATED');
        await page.getByRole('button', { name: /Save Changes|Uložit změny/i }).click();

        await expect(
            page.getByText(/School updated successfully|Škola.*aktualizována|aktualizována|úspěšně/i),
        ).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(TEST_SCHOOL_NAME + ' UPDATED')).toBeVisible();

        // 3. Delete School. The delete dialog has a "type the name" guard, so
        // we fill it before confirming.
        await schoolRow.getByRole('button', { name: /Delete|Smazat/i }).click();
        const deleteDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
        const confirmInput = deleteDialog.locator('input').last();
        if (await confirmInput.isVisible().catch(() => false)) {
            await confirmInput.fill(TEST_SCHOOL_NAME + ' UPDATED');
        }
        await page
            .getByRole('button', { name: /Confirm|Potvrdit|Delete|Smazat/i })
            .last()
            .click();

        await expect(page.getByText(TEST_SCHOOL_NAME + ' UPDATED')).not.toBeVisible({ timeout: 10_000 });
    });

    test('Login as all roles to a school', async ({ page }) => {
        // Emails must match what `data/demo-seed.json` produces — the seed
        // is the source of truth, not the test.
        const roles = [
            { email: 'horak@skola.test', label: 'PRINCIPAL' },
            { email: 'novakova@skola.test', label: 'DEPUTY' },
            { email: 'svoboda@skola.test', label: 'TEACHER' },
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
