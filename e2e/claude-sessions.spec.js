// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Claude Session Monitor', () => {
  // NOTE: API mocks must be installed BEFORE page.goto() — the app polls
  // /api/claude-sessions immediately on load, and on a machine where hooks
  // are genuinely configured the real response would win over a late mock.

  test('Claude column is hidden when hooks not configured', async ({ page }) => {
    // Mock API returning hookConfigured: false
    await page.route('**/api/claude-sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ hookConfigured: false, sessions: [] }), contentType: 'application/json' })
    );
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });
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
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });
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
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });
    await page.waitForTimeout(6000);

    const zombieSection = page.locator('.claude-summary-zombies');
    await expect(zombieSection).toBeVisible();
    await expect(zombieSection).toContainText('1 zombie');
    await expect(zombieSection.locator('.claude-zombie-kill')).toBeVisible();
  });

  test('sessions in folders VS Code does not list appear under Other sessions', async ({ page }) => {
    await page.route('**/api/claude-hooks', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'installed', events: {}, legacy: false, scriptPath: '/x' }) }));
    await page.route('**/api/claude-sessions', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hookConfigured: true,
          sessions: [
            { pid: 11, sessionId: 'u1', cwd: '/Users/nobody/unlisted-folder', startedAt: Date.now(), entrypoint: 'cli', state: 'working' },
            { pid: 12, sessionId: 'u2', cwd: '/Users/nobody/unlisted-folder', startedAt: Date.now(), entrypoint: 'cli', state: 'idle' },
          ],
        }),
      }));
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });

    const other = page.getByRole('region', { name: /other sessions/i });
    await expect(other).toBeVisible({ timeout: 10000 });
    await expect(other).toContainText('unlisted-folder');
    await expect(other).toContainText('1 working');
    await expect(other.getByRole('button', { name: 'Open unlisted-folder in VS Code' })).toBeVisible();

    // The working filter has no rows to show: the table says why
    await page.locator('.claude-summary-working').click();
    await expect(page.locator('.no-results')).toContainText("No workspace rows have working sessions");
    await expect(page.locator('.no-results')).toContainText('see Other sessions above');
  });
});

