// @ts-check
// Slice 1 - Customer Info tab: add + validate a customer, advance step_1.
const { test, expect } = require('@playwright/test');

test.describe('Customer Info tab', () => {
  test('adds a valid customer, who then appears in the dashboard at 0%', async ({ page }) => {
    const name = `E2E Add ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();

    await page.locator('#name').fill(name);
    await page.locator('#contactEmail').fill('valid@example.com');
    await page.locator('#industry').fill('Software');
    await page.getByRole('button', { name: 'Add customer' }).click();

    // Success banner + the customer shows up in this tab's queue.
    await expect(page.locator('.banner.success')).toContainText(name);
    await expect(page.locator('.customer-card', { hasText: name })).toBeVisible();

    // And in the dashboard queue at 0%.
    await page.getByRole('button', { name: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.locator('.progress-bar')).toHaveText('');
    await expect(card.locator('.next-action')).toContainText('Customer Info');
  });

  test('shows a validation error for an invalid email and creates nothing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();

    await page.locator('#name').fill('Should Not Be Created');
    await page.locator('#contactEmail').fill('not-an-email');
    await page.getByRole('button', { name: 'Add customer' }).click();

    // Inline field error under the email input + error banner.
    await expect(page.locator('.field-error')).toBeVisible();
    await expect(page.locator('.banner.error')).toBeVisible();
    await expect(page.locator('.customer-card', { hasText: 'Should Not Be Created' })).toHaveCount(0);
  });

  test('marking Customer Info complete advances progress to 25%', async ({ page }) => {
    const name = `E2E Complete ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();

    await page.locator('#name').fill(name);
    await page.locator('#contactEmail').fill('complete@example.com');
    await page.getByRole('button', { name: 'Add customer' }).click();

    const card = page.locator('.customer-card', { hasText: name });
    await card.getByRole('button', { name: 'Mark Customer Info complete' }).click();

    // Button flips to the completed state.
    await expect(card.getByRole('button', { name: 'Customer Info complete' })).toBeVisible();

    // Dashboard reflects 25% for this customer.
    await page.getByRole('button', { name: 'Dashboard' }).click();
    const dashCard = page.locator('.customer-card', { hasText: name });
    await expect(dashCard.locator('.progress-bar')).toContainText('25%');
  });
});
