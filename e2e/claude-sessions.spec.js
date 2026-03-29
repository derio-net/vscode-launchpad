// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Claude Session Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });
  });

  test('Claude column is hidden when hooks not configured', async ({ page }) => {
    // Mock API returning hookConfigured: false
    await page.route('**/api/claude-sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ hookConfigured: false, sessions: [] }), contentType: 'application/json' })
    );
    await page.waitForTimeout(6000);
    await expect(page.locator('th:has-text("Claude")')).not.toBeVisible();
    await expect(page.locator('.claude-summary')).not.toBeVisible();
  });

  test('Claude column visible when hooks configured with sessions', async ({ page }) => {
    await page.route('**/api/claude-sessions', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hookConfigured: true,
          sessions: [
            { pid: 1, sessionId: 's1', cwd: '/fake', startedAt: Date.now(), entrypoint: 'cli', state: 'working' },
            { pid: 2, sessionId: 's2', cwd: '/fake2', startedAt: Date.now(), entrypoint: 'cli', state: 'waiting' },
            { pid: 3, sessionId: 's3', cwd: '/fake3', startedAt: Date.now(), entrypoint: 'cli', state: 'idle' },
          ],
        }),
      })
    );
    await page.waitForTimeout(6000);

    // Summary should show
    const summary = page.locator('.claude-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('3 sessions');
    await expect(summary).toContainText('working');
    await expect(summary).toContainText('waiting');
  });

  test('Zombie section appears with kill button', async ({ page }) => {
    await page.route('**/api/claude-sessions', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hookConfigured: true,
          sessions: [
            { pid: 999, sessionId: 'z1', cwd: '/old/project', startedAt: Date.now() - 3600000, entrypoint: 'cli', state: 'zombie' },
          ],
        }),
      })
    );
    await page.waitForTimeout(6000);

    const zombieSection = page.locator('.claude-summary-zombies');
    await expect(zombieSection).toBeVisible();
    await expect(zombieSection).toContainText('1 zombie');
    await expect(zombieSection.locator('.claude-zombie-kill')).toBeVisible();
  });
});
