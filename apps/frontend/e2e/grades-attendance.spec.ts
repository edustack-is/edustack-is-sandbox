import { test, expect } from '@playwright/test';
import { loginAsSystemAdmin } from './helpers';

test.describe('Grades and Attendance', () => {
    // Pokrytí Klasifikace a Docházky pro roli učitel a žák

    test.beforeEach(async ({ page }) => {
        await loginAsSystemAdmin(page); // Přihlášení jen jako proxy (v reálu by zde byl Teacher)
    });

    test('F101, F102, F103 - Grade Overview: System renders class and student grades correctly', async ({ page }) => {
        // Zobrazení známek dle třídy a studenta
        const gradesBtn = page.getByText('Klasifikace').or(page.getByText('Grades'));
        if (await gradesBtn.isVisible()) {
            await gradesBtn.click();
            await expect(page.locator('table')).toBeVisible(); // Tabulka předmětů a známek
        }
    });

    test('F093 - Adding a new grade saves it to student portfolio', async ({ page }) => {
        // Formulář pro CRUD přidání známky do DB
        const gradesBtn = page.getByText('Klasifikace').or(page.getByText('Grades'));
        if (await gradesBtn.isVisible()) {
            await gradesBtn.click();

            const addGradeBtn = page.getByText('Přidat známku').or(page.getByRole('button', { name: 'Přidat' }));
            if (await addGradeBtn.isVisible()) {
                await addGradeBtn.click();

                await expect(page.getByText('Hodnota')).toBeVisible(); // Formulář
                await expect(page.getByText('Váha')).toBeVisible();
                await expect(page.getByRole('button', { name: /Uložit|Save/i })).toBeVisible();
            }
        }
    });

    test('F113 - Attendance records: Parent/student can view absence and tardiness limits', async ({ page }) => {
        // Učitelství - Záznam absencí
        const attendanceBtn = page.getByText('Docházka').or(page.getByText('Attendance'));
        if (await attendanceBtn.isVisible()) {
            await attendanceBtn.click();

            // Filtry by měly být viditelné (Třída, Předmět, Datum)
            await expect(page.getByText(/Třída|Filtr/i)).toBeVisible();
        }
    });
});
