import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('System Admin - General Management', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('System Users - Create and Remove', async ({ page }) => {
        await page.getByTestId('sidebar-users').click();

        const testAdminEmail = `sysadmin.${Date.now()}@test.skola.cz`;

        // Create — the add dialog has unnamed inputs driven by useState, so we
        // address them by their placeholder / label text.
        await page.getByRole('button', { name: /Add Administrator|Přidat administrátora/i }).click();
        const addDialog = page.getByRole('dialog');
        await addDialog.locator('input[type="email"]').fill(testAdminEmail);
        await addDialog.getByPlaceholder(/^Jan$/).fill('Test');
        await addDialog.getByPlaceholder(/^Novák$/).fill('Admin');
        await addDialog.getByRole('button', { name: /Add Administrator|Přidat administrátora/i }).click();

        await expect(page.getByText(testAdminEmail)).toBeVisible({ timeout: 10_000 });

        // Remove (delete confirm shows in an alert dialog).
        const userRow = page.locator('tr', { hasText: testAdminEmail });
        await userRow.getByRole('button', { name: /Remove|Odebrat|Delete|Smazat/i }).click();
        await page
            .getByRole('button', { name: /Remove|Odebrat|Confirm|Potvrdit|Delete|Smazat/i })
            .last()
            .click();

        await expect(page.getByText(testAdminEmail)).not.toBeVisible({ timeout: 10_000 });
    });

    test('AI Management - Set and Remove Keys', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /AI Management|Správa AI|Zap/i })
            .or(page.locator('button[value="ai"]'))
            .click();

        // The Gemini row is identified by its label, not by the input placeholder
        // (which becomes "Nakonfigurováno (****_KEY)" once a key exists). We grab
        // the textbox sitting under the "Google Gemini" label.
        const geminiInput = page
            .locator('div', { hasText: /^Google Gemini/ })
            .locator('xpath=ancestor::div[1]')
            .locator('input[type="password"], input[type="text"]')
            .first();

        // 1. Set Key
        await geminiInput.fill('TEST_GEMINI_KEY');
        await page.getByRole('button', { name: /Save Keys|Uložit klíče/i }).click();
        await expect(page.getByText(/Saved|Uloženo|Success|Úspěch|aktualiz|updated/i).first()).toBeVisible({
            timeout: 10_000,
        });

        // 2. Remove Key — the row exposes a "Smazat klíč" / "Delete key"
        // action when a key is set. Falling back to clearing the field also works.
        const deleteBtn = page.getByRole('button', { name: /Smazat klíč|Delete key/i }).first();
        if (await deleteBtn.isVisible().catch(() => false)) {
            await deleteBtn.click();
            // Some flows confirm the deletion in a small modal.
            const confirm = page.getByRole('button', { name: /Confirm|Potvrdit|Delete|Smazat|Yes|Ano/i }).last();
            if (await confirm.isVisible({ timeout: 1_000 }).catch(() => false)) {
                await confirm.click();
            }
        } else {
            await geminiInput.fill('');
            await page.getByRole('button', { name: /Save Keys|Uložit klíče/i }).click();
        }
        await expect(page.getByText(/Saved|Uloženo|Success|Úspěch|smazán|deleted|updated/i).first()).toBeVisible({
            timeout: 10_000,
        });
    });

    test('SSO Setup - Add and Remove Client Credentials', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /SSO Integrations|SSO Integrace|Globe/i })
            .or(page.locator('button[value="sso"]'))
            .click();

        // Each provider is rendered as a clickable Card (not a <button>), so
        // we click the card via its label text inside the tabpanel.
        const ssoPanel = page.getByRole('tabpanel');
        await ssoPanel.getByText('Google', { exact: true }).first().click();

        // The credential form uses id="clientId" / id="clientSecret".
        await page.locator('#clientId').fill('google-test-id');
        await page.locator('#clientSecret').fill('google-test-secret');
        await page
            .getByRole('button', { name: /Save Configuration|Uložit konfiguraci|Save|Uložit/i })
            .first()
            .click();

        await expect(page.getByText(/updated successfully|úspěšně uložena|Success|Úspěch|uložen/i).first()).toBeVisible(
            { timeout: 10_000 },
        );

        // Remove via the per-card delete button (top-right of the Google card).
        // The card exposes a destructive button once `isConfigured`. The confirm
        // dialog then asks for explicit confirmation.
        const googleCard = ssoPanel
            .locator('div')
            .filter({ hasText: /^Google.*Aktivní|^Google.*Active/ })
            .first();
        const deleteBtn = googleCard.getByRole('button').first();
        if (await deleteBtn.isVisible().catch(() => false)) {
            await deleteBtn.click();
            await page
                .getByRole('button', { name: /Confirm|Potvrdit|Delete|Smazat/i })
                .last()
                .click();
            await expect(page.getByText(/smazána|deleted|removed|aktualizováno/i).first()).toBeVisible({
                timeout: 10_000,
            });
        }
    });

    test('System Settings - Security & Name', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /General|Obecné|Settings|Nastavení|Systém/i })
            .or(page.locator('button[value="system"]'))
            .click();

        // 1. System Name
        const nameInput = page.locator('input[name="systemName"]');
        if (await nameInput.isVisible()) {
            await nameInput.fill('EduStack E2E Test');
            await page
                .getByRole('button', { name: /Save|Uložit/i })
                .first()
                .click();
            await expect(page.getByText(/Saved|Uloženo|Success|Úspěch/i)).toBeVisible();
        }

        // 2. Security Settings (toggles)
        const securityToggles = page.locator('button[role="switch"]');
        if ((await securityToggles.count()) > 0) {
            await securityToggles.first().click();
            await expect(page.getByText(/Updated|Aktualizováno|Saved|Uloženo|Success|Úspěch/i)).toBeVisible();
        }
    });

    test('Monitoring Page - Verify Presence', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /Monitoring|Sledování|Status|Activity/i })
            .or(page.locator('button[value="monitoring"]'))
            .click();

        // The monitoring panel always renders a "Systémový audit log" /
        // "System audit log" section. Asserting on that text is enough to
        // prove the panel mounted; the test doesn't need a specific role.
        await expect(page.getByText(/Systémový audit log|System audit log|audit log/i).first()).toBeVisible({
            timeout: 10_000,
        });
    });
});
