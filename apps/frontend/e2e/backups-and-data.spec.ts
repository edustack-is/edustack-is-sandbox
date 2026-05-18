import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('Backups & Testing Data', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('Manage Backups', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /Backups|Zálohy|HardDrive/i })
            .or(page.locator('button[value="backups"]'))
            .click();

        // 1. Create Backup. The toolbar "Vytvořit zálohu" first opens a small
        // dialog that asks for a backup name; the submit ("Vytvořit") inside
        // the dialog is what actually triggers the upload + toast.
        await page
            .getByRole('button', { name: /Create Backup|Vytvořit zálohu/i })
            .first()
            .click();
        const createBackupDialog = page.getByRole('dialog');
        await expect(createBackupDialog).toBeVisible({ timeout: 5_000 });
        const backupName = `e2e-${Date.now()}`;
        await createBackupDialog.locator('input').first().fill(backupName);
        await createBackupDialog.getByRole('button', { name: /^Vytvořit$|^Create$/ }).click();
        await expect(page.getByText(/Backup created|Záloha vytvořena|úspěšně/i).first()).toBeVisible({
            timeout: 15_000,
        });

        // 2. Restore (UI check). Row actions now have aria-labels; pick the
        // Restore one by accessible name so we don't depend on column order.
        const newRow = page.locator('tr', { hasText: backupName }).first();
        await newRow.getByRole('button', { name: /Restore|Obnovit/i }).click();
        await expect(page.getByText(/Are you sure|Opravdu chcete|Obnovit|restore/i).first()).toBeVisible({
            timeout: 5_000,
        });
        await page.getByRole('button', { name: /Cancel|Zrušit/i }).click();
    });

    test('Testing Data Generation & Wipe', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page
            .getByRole('tab', { name: /Test Data|Testovací data|Database/i })
            .or(page.locator('button[value="testdata"]'))
            .click();

        // 1. AI Name Generation (Magic Wand). The school-name input has
        // placeholder "Název školy" in this build (not "Testovací škola").
        const nameInput = page.locator('input[placeholder="Název školy"]');
        await expect(nameInput).toBeVisible({ timeout: 10_000 });
        await nameInput.fill('');

        await page.route('**/api/ai/generate-school-name', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ name: 'AI Generated School' }),
            });
        });

        // The wand button has title containing "AI" (e.g. "AI generovat název").
        await page.locator('button[title*="AI" i]').first().click();
        await expect(nameInput).toHaveValue('AI Generated School', { timeout: 5_000 });

        // 2. Generate Data (mock response for speed).
        await page.route('**/api/system/test-data/generate', (route) => {
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });
        await page.getByRole('button', { name: /Generovat školu s daty|Generate school with data/i }).click();

        // 3. Wipe All — the page only exposes a global "Smazat vše" button
        // (per-school delete needs a dropdown selection). Stub the endpoint
        // so reruns don't actually empty the local DB.
        await page.route('**/api/system/test-data/wipe-all', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });
        await page.getByRole('button', { name: /Delete All Data|Smazat vše|Smazat všechna data/i }).click();
        // The confirm dialog has a "type to confirm" guard. The required
        // string lives in i18n (`SMAZAT VŠE` in cs, `WIPE ALL` in en) — we
        // type both regardless of locale; only the matching one enables the
        // button.
        const wipeDialog = page.getByRole('dialog').last();
        await expect(wipeDialog).toBeVisible({ timeout: 5_000 });
        const confirmInput = wipeDialog.locator('input').last();
        // Try CS first; if app is in EN, the button stays disabled and we
        // fall through to type the EN variant.
        await confirmInput.fill('SMAZAT VŠE');
        const confirmBtn = wipeDialog
            .getByRole('button', { name: /Smazat vše nenávratně|Delete everything permanently/i })
            .last();
        if (!(await confirmBtn.isEnabled().catch(() => false))) {
            await confirmInput.fill('WIPE ALL');
        }
        await confirmBtn.click({ timeout: 5_000 });
    });
});
