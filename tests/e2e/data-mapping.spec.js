// @ts-check
// Slice 3 - Data Mapping tab: suggest a mapping, then confirm it.
const { test, expect } = require('@playwright/test');

test.describe('Data Mapping tab', () => {
  test('suggests a column mapping and confirms it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();

    // A customer auto-selects from the queue; request a suggestion.
    await page.getByRole('button', { name: 'Suggest mapping' }).click();

    // The suggested column map renders with a source column and a target select.
    const mappingTable = page.locator('.mapping-table').first();
    await expect(mappingTable).toBeVisible();
    await expect(mappingTable.locator('tbody tr').first()).toBeVisible();

    // Confirm the mapping and complete the step.
    await page.getByRole('button', { name: /Confirm mapping & complete step/ }).click();
    await expect(page.getByText(/Mapping confirmed/i)).toBeVisible();
  });
});
