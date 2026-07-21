// @ts-check
// Slice 2 - Import tab: pick a sample CSV, see detected schema/date + preview.
const { test, expect } = require('@playwright/test');

test.describe('Import tab', () => {
  test('previews Customer A sample with detected Title Case + MM/DD/YYYY', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await page.getByRole('button', { name: /Customer A - ABC Accounting/ }).click();

    // Detected metadata.
    await expect(page.locator('.customer-meta')).toContainText('Title Case');
    await expect(page.locator('.customer-meta')).toContainText('MM/DD/YYYY');

    // Preview table renders headers + at least one data row.
    await expect(page.locator('.preview-table')).toBeVisible();
    await expect(page.locator('.preview-table thead th').first()).toBeVisible();
    await expect(page.locator('.preview-table tbody tr').first()).toBeVisible();
  });

  test('previews Customer C sample with detected snake_case + DD-MM-YYYY', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    await page.getByRole('button', { name: /Customer C - Premier Bookkeeping/ }).click();

    await expect(page.locator('.customer-meta')).toContainText('snake_case');
    await expect(page.locator('.customer-meta')).toContainText('DD-MM-YYYY');
    await expect(page.locator('.preview-table')).toBeVisible();
  });
});
