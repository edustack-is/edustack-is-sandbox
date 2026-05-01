import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin, switchLanguage } from './helpers';

test.describe('User Profile & Settings', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('Change Language', async ({ page }) => {
        await page.goto('/profile');

        // Switch to EN
        await switchLanguage(page, 'EN');
        await expect(page.getByRole('heading', { name: 'My Profile', exact: true })).toBeVisible();

        // Switch to CZ
        await switchLanguage(page, 'CZ');
        await expect(page.getByRole('heading', { name: 'Můj profil', exact: true })).toBeVisible();
    });

    test('Set Profile Photo (Emoji Avatar)', async ({ page }) => {
        await page.goto('/profile');

        // Open avatar picker - button with Camera or Change Avatar
        await page
            .getByRole('button', { name: /avatar|photo|profil/i })
            .first()
            .click();

        // Select an emoji (e.g., fox) - usually by title or content
        const emojiBtn = page.locator('button[title="fox"]').or(page.getByRole('button', { name: '🦊' }));
        await emojiBtn.click({ timeout: 10000 });

        await expect(page.getByText(/Avatar set!|Avatar nastaven!/i)).toBeVisible();
    });

    test('Change Password Flow', async ({ page }) => {
        await page.goto('/profile');

        const currentPass = 'Demo1234!';
        const newPass = 'NewSecurePass123!';

        // 1. Mismatch validation
        await page.fill('input#currentPassword', currentPass);
        await page.fill('input#newPassword', newPass);
        await page.fill('input#confirmNewPassword', 'mismatch');
        await page.getByRole('button', { name: /Update Password|Aktualizovat heslo/i }).click();

        await expect(page.getByText(/Passwords do not match|hesla se neshodují/i)).toBeVisible();

        // 2. Successful change (We won't actually finish it to not break other tests, or we change it back)
        await page.fill('input#confirmNewPassword', newPass);

        // Intercept to avoid actually changing the password of the demo account
        await page.route('**/api/auth/change-password', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'password_changed_success' }),
            });
        });

        await page.getByRole('button', { name: /Update Password|Aktualizovat heslo/i }).click();
        await expect(page.getByText(/Password updated successfully|Heslo bylo úspěšně změněno/i)).toBeVisible();
    });

    test('View SSO Integrations', async ({ page }) => {
        await page.goto('/profile');
        await expect(page.getByText(/Connected Accounts|Propojené účty/i)).toBeVisible();
    });
});
