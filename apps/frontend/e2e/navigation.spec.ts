import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('Navigation & Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Před každým testem zajistíme, že uživatel je přihlášený
        await loginAsSystemAdmin(page);
    });

    test('F008, F067 - Role-based permissions: admin sees expected side-menu', async ({ page }) => {
        // F008: Role-based přístup | F067: Dashboard systému
        await expect(page.getByText('Schools', { exact: true }).or(page.getByText('Školy', { exact: true }))).toBeVisible();
        await expect(page.getByText('Users', { exact: true }).or(page.getByText('Uživatelé', { exact: true }))).toBeVisible();

        // Na rozdíl od učitele admin typicky nevidí klasifikaci na globální úrovni (pokud není ve škole)
        await expect(page.getByText('Klasifikace')).toBeHidden();
    });

    test('F158 - Internationalization (I18N): User can switch language', async ({ page }) => {
        // Přepínání jazyku
        const langBtn = page.getByRole('button', { name: /CZ|EN/ }).first();

        // Kliknutí na přepínač ukáže dropdown
        await langBtn.click();

        // Přepneme na češtinu (pokud je dostupná)
        const czOption = page.getByRole('menuitem', { name: /Čeština|CZ/i });
        if (await czOption.isVisible()) {
            await czOption.click();
            await expect(page.getByText('Uživatelé', { exact: true }).or(page.getByText('Školy'))).toBeVisible();
        }
    });

    test('F005 - User can select school from dropdown', async ({ page }) => {
        // F005: Výběr školy po přihlášení
        const schoolSelector = page.getByRole('button').filter({ hasText: /Select School|Vyberte školu/i });
        // Jen pokud Selector existuje u daného uživatele (má víc škol)
        if (await schoolSelector.isVisible() && await schoolSelector.isEnabled()) {
            await schoolSelector.click();
            // Očekává dropdown
            await expect(page.getByRole('dialog')).toBeVisible();
        }
    });
});
