import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('System Admin - General Management', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page);
    });

    test('System Users - Create and Remove', async ({ page }) => {
        await page.getByTestId('sidebar-users').click();
        
        const testAdminEmail = `sysadmin.${Date.now()}@test.skola.cz`;

        // Create
        await page.getByRole('button', { name: /Add Administrator|Přidat administrátora/i }).click();
        await page.fill('input[name="firstName"]', 'Test');
        await page.fill('input[name="lastName"]', 'Admin');
        await page.fill('input[name="email"]', testAdminEmail);
        await page.getByRole('button', { name: /Add Administrator|Přidat administrátora/i }).last().click();

        await expect(page.getByText(testAdminEmail)).toBeVisible();

        // Remove
        const userRow = page.locator('tr', { hasText: testAdminEmail });
        await userRow.getByRole('button', { name: /Remove|Odebrat/i }).click();
        await page.getByRole('button', { name: /Remove|Odebrat/i }).last().click();

        await expect(page.getByText(testAdminEmail)).not.toBeVisible();
    });

    test('AI Management - Set and Remove Keys', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page.getByRole('tab', { name: /AI Management|Správa AI|Zap/i }).or(page.locator('button[value="ai"]')).click();

        // 1. Set Key
        await page.fill('input[placeholder*="Gemini"]', 'TEST_GEMINI_KEY');
        await page.getByRole('button', { name: /Save Keys|Uložit klíče/i }).click();
        // Check for toast, more flexible text
        await expect(page.getByText(/Saved|Uloženo|Success|Úspěch/i)).toBeVisible();

        // 2. Remove Key (clear it)
        await page.fill('input[placeholder*="Gemini"]', '');
        await page.getByRole('button', { name: /Save Keys|Uložit klíče/i }).click();
        await expect(page.getByText(/Saved|Uloženo|Success|Úspěch/i)).toBeVisible();
    });

    test('SSO Setup - Add and Remove Client Credentials', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page.getByRole('tab', { name: /SSO Integrations|SSO Integrace|Globe/i }).or(page.locator('button[value="sso"]')).click();

        // Select Google integration
        await page.getByRole('button', { name: /Google/i }).click();

        // Set credentials
        await page.fill('input[name="clientId"]', 'google-test-id');
        await page.fill('input[name="clientSecret"]', 'google-test-secret');
        await page.getByRole('button', { name: /Save Configuration|Uložit konfiguraci/i }).click();
        
        await expect(page.getByText(/updated successfully|úspěšně uložena|Success|Úspěch/i)).toBeVisible();

        // Disable/Remove (or just clear secret)
        await page.fill('input[name="clientId"]', '');
        await page.fill('input[name="clientSecret"]', '');
        await page.getByRole('button', { name: /Save Configuration|Uložit konfiguraci/i }).click();
        await expect(page.getByText(/updated successfully|úspěšně uložena|Success|Úspěch/i)).toBeVisible();
    });

    test('System Settings - Security & Name', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        await page.getByRole('tab', { name: /General|Obecné|Settings|Nastavení|Systém/i }).or(page.locator('button[value="system"]')).click();

        // 1. System Name
        const nameInput = page.locator('input[name="systemName"]');
        if (await nameInput.isVisible()) {
            await nameInput.fill('EduStack E2E Test');
            await page.getByRole('button', { name: /Save|Uložit/i }).first().click();
            await expect(page.getByText(/Saved|Uloženo|Success|Úspěch/i)).toBeVisible();
        }

        // 2. Security Settings (toggles)
        const securityToggles = page.locator('button[role="switch"]');
        if (await securityToggles.count() > 0) {
            await securityToggles.first().click();
            await expect(page.getByText(/Updated|Aktualizováno|Saved|Uloženo|Success|Úspěch/i)).toBeVisible();
        }
    });

    test('Monitoring Page - Verify Presence', async ({ page }) => {
        await page.getByTestId('sidebar-system-settings').click();
        // Be more flexible with the monitoring tab name
        await page.getByRole('tab', { name: /Monitoring|Sledování|Status|Activity/i }).or(page.locator('button[value="monitoring"]')).click();

        await expect(page.getByRole('heading', { name: /System|Systém/i }).filter({ hasText: /Log/i }).or(page.getByText('Systémový log'))).toBeVisible();
    });
});
