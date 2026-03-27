/**
 * E2E tests for the Dashboard page
 * Tests critical user workflows using Playwright
 * 
 * Prerequisites: Run `npm run dev` before running E2E tests
 * or configure webServer in playwright.config.js
 */
const { test, expect } = require('@playwright/test');

test.describe('Spec: User can view dashboard with workspace list', () => {
  test('dashboard loads successfully', async ({ page }) => {
    await page.goto('/');

    // Page should load without errors
    await expect(page).toHaveTitle(/VS Code Launchpad/i);
  });

  test('dashboard shows loading state then workspaces', async ({ page }) => {
    await page.goto('/');

    // Either loading state or workspace table should be visible
    const loadingOrTable = page.locator('.loading-container, table, .workspace-table');
    await expect(loadingOrTable.first()).toBeVisible({ timeout: 10000 });
  });

  test('workspace table is visible after loading', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to complete
    await page.waitForSelector('.loading-container', { state: 'hidden', timeout: 15000 }).catch(() => {
      // Loading may not appear if API is fast
    });

    // Table should be visible
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Spec: Dark theme is applied correctly', () => {
  test('dark theme colors are applied to the app', async ({ page }) => {
    await page.goto('/');

    // Check that the app container has dark theme styling
    const appContainer = page.locator('.app');
    await expect(appContainer).toBeVisible({ timeout: 10000 });

    // Verify dark background color is applied
    const backgroundColor = await appContainer.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Dark theme should have a dark background (not white)
    expect(backgroundColor).not.toBe('rgb(255, 255, 255)');
  });
});

test.describe('Spec: Column headers are visible', () => {
  test('workspace table has expected column headers', async ({ page }) => {
    await page.goto('/');

    // Wait for table to load
    await page.waitForSelector('table', { timeout: 15000 }).catch(() => {});

    // Check for column headers
    const nameHeader = page.locator('th', { hasText: 'Name' });
    await expect(nameHeader).toBeVisible({ timeout: 5000 });
  });
});
