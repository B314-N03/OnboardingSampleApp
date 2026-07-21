// @ts-check
// Slice 4 - Tenant Setup tab: pick a plan and provision the tenant to active.
const { test, expect } = require('@playwright/test');

test.describe('Tenant Setup tab', () => {
  test('provisions a tenant through to active', async ({ page }) => {
    // Create a dedicated customer so this test owns its tenant state.
    const name = `E2E Tenant ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.locator('#name').fill(name);
    await page.locator('#contactEmail').fill('tenant@example.com');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.locator('.banner.success')).toContainText(name);

    // Switch to Tenant Setup and select the new customer.
    await page.getByRole('button', { name: 'Tenant Setup' }).click();
    await page.locator('select').first().selectOption({ label: `${name} (0%)` });

    // Choose a plan and provision.
    await page.locator('.customer-card select').selectOption('enterprise');
    await page.getByRole('button', { name: 'Provision tenant' }).click();

    // pending -> provisioning -> active (there is an ~800ms delay in the flow).
    await expect(page.locator('.customer-card')).toContainText('active', { timeout: 5000 });
    await expect(page.getByText(/Tenant provisioned and Tenant Setup marked complete/i)).toBeVisible();
  });
});
