/**
 * E2E tests for column visibility via the header context menu
 */
const { test, expect } = require('@playwright/test');

test.describe('Spec: User can toggle column visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table', { timeout: 15000 });
  });

  test('no standalone columns dropdown button is rendered', async ({ page }) => {
    await expect(page.locator('button', { hasText: /columns/i })).toHaveCount(0);
  });

  test('right-clicking the header row opens the column context menu', async ({ page }) => {
    await page.locator('thead tr').click({ button: 'right' });
    await expect(page.locator('.column-context-menu')).toBeVisible();
  });

  test('select column is not listed in the menu', async ({ page }) => {
    await page.locator('thead tr').click({ button: 'right' });
    await expect(page.locator('.column-context-menu [data-menu-key]').first()).toBeVisible();
    await expect(page.locator('.column-context-menu [data-menu-key="select"]')).toHaveCount(0);
  });

  test('Name checkbox is checked, disabled, and shows a lock', async ({ page }) => {
    await page.locator('thead tr').click({ button: 'right' });
    const nameCheckbox = page.locator('.column-context-menu [data-menu-key="name"] input');
    await expect(nameCheckbox).toBeChecked();
    await expect(nameCheckbox).toBeDisabled();
    await expect(page.locator('.column-context-menu [data-menu-key="name"] .column-lock')).toBeVisible();
  });

  test('unchecking Connection hides the column; rechecking shows it', async ({ page }) => {
    await page.locator('thead tr').click({ button: 'right' });
    const connectionCheckbox = page.locator('.column-context-menu [data-menu-key="connection"] input');

    await connectionCheckbox.click();
    await expect(page.locator('th[data-column-key="connection"]')).toHaveCount(0);

    await connectionCheckbox.click();
    await expect(page.locator('th[data-column-key="connection"]')).toHaveCount(1);
  });

  test('Escape closes the menu', async ({ page }) => {
    await page.locator('thead tr').click({ button: 'right' });
    await expect(page.locator('.column-context-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.column-context-menu')).toHaveCount(0);
  });

  test('Name column is visible by default', async ({ page }) => {
    const nameHeader = page.locator('th', { hasText: 'Name' });
    await expect(nameHeader).toBeVisible({ timeout: 5000 });
  });

  test('Connection column is visible by default', async ({ page }) => {
    const connectionHeader = page.locator('th', { hasText: 'Connection' });
    await expect(connectionHeader).toBeVisible({ timeout: 5000 });
  });

  test('Full Path column is hidden by default', async ({ page }) => {
    const fullPathHeader = page.locator('th', { hasText: 'Full Path' });
    const isVisible = await fullPathHeader.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
