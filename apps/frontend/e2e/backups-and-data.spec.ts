import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('Backups & Testing Data', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('Manage Backups', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page.getByRole('tab', { name: /Backups|Zálohy|HardDrive/i }).or(page.locator('button[value="backups"]')).click();

        // 1. Create Backup
        await page.getByRole('button', { name: /Create Backup|Vytvořit zálohu/i }).click();
        await expect(page.getByText(/Backup created|Záloha vytvořena/i)).toBeVisible();

        // 2. Download (mock)
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /Download|Stáhnout/i }).first().click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('.sqlite');

        // 3. Restore (UI check)
        await page.getByRole('button', { name: /Restore|Obnovit/i }).first().click();
        await expect(page.getByText(/Are you sure|Opravdu chcete/i)).toBeVisible();
        await page.getByRole('button', { name: /Cancel|Zrušit/i }).click();
    });

    test('Testing Data Generation & Wipe', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page.getByRole('tab', { name: /Test Data|Testovací data|Database/i }).or(page.locator('button[value="testdata"]')).click();

        // 1. AI Name Generation (Magic Wand)
        const nameInput = page.locator('input[placeholder="Testovací škola"]');
        await nameInput.clear();
        
        await page.route('**/api/ai/generate-school-name', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ name: 'AI Generated School' }),
            });
        });

        // Use more specific selector for the wand button
        await page.locator('button[title*="AI"]').first().click();
        await expect(nameInput).toHaveValue('AI Generated School');

        // 2. Generate Data (mock response for speed)
        await page.route('**/api/system/test-data/generate', (route) => {
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });
        
        // Target the primary "Generate" button, not the AI wand one
        await page.getByRole('button', { name: /Generovat školu s daty|Generate school with data/i }).click();
        // The generator usually shows success via toast or closing dialog
        // await expect(page.getByText(/Success|Úspěch/i)).toBeVisible();

        // 3. Delete Schools / Wipe All Data
        await page.getByRole('button', { name: /Delete Schools|Smazat školy/i }).click();
        await page.getByRole('button', { name: /Confirm|Potvrdit/i }).click();
        
        await page.getByRole('button', { name: /Delete All Data|Smazat všechna data/i }).click();
        await page.getByRole('button', { name: /Confirm|Potvrdit/i }).click();
    });
});
