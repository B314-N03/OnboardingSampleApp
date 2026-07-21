// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Onboarding Dashboard', () => {
  test('should display the dashboard heading', async ({ page }) => {
    await page.goto('/');

    // Verify the main heading is visible
    await expect(page.locator('h1')).toContainText('Onboarding Dashboard');
  });

  test('should show navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Verify all navigation tabs are present
    await expect(page.locator('.tab')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Customer Info' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Mapping' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tenant Setup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  });

  test('should display example customer in onboarding queue', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load and verify the seeded example customer is shown.
    // Scope to the Acme card by name: the shared in-memory backend may hold
    // other customers created by earlier tests, so a bare `.customer-card`
    // locator would match several elements.
    const acmeCard = page.locator('.customer-card', { hasText: 'Acme Corporation' });
    await expect(acmeCard).toBeVisible();
    await expect(acmeCard.locator('h3')).toContainText('Acme Corporation');
  });

  test('should switch to the (now real) Customer Info tab', async ({ page }) => {
    await page.goto('/');

    // Click on Customer Info tab
    await page.getByRole('button', { name: 'Customer Info' }).click();

    // The tab is now a real form, not a placeholder.
    await expect(page.getByRole('heading', { name: 'Customer Info' })).toBeVisible();
    await expect(page.locator('form.customer-form')).toBeVisible();
  });

  test('should show the triage controls on the dashboard', async ({ page }) => {
    await page.goto('/');

    // Slice 5 triage: sort control + hide-completed filter.
    await expect(page.locator('.triage-controls select')).toBeVisible();
    await expect(page.locator('.triage-controls input[type="checkbox"]')).toBeVisible();

    // Each queued customer shows a "next action" hint.
    await expect(page.locator('.customer-card .next-action').first()).toBeVisible();
  });
});
