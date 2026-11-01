// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Spec: Claude Code status control + repair banner (claude-session-dashboard).
 * Mocks must be installed BEFORE page.goto(): the app fetches both endpoints on load.
 */
const hookStatus = (status, extra = {}) => ({
  status,
  scriptPath: '/home/u/.claude/vscode-launchpad/hook.sh',
  legacy: false,
  events: { Notification: status === 'installed', UserPromptSubmit: status === 'installed', Stop: status === 'installed' },
  ...extra,
});

/** `extra` (e.g. a needs-repair reason) applies until install flips the status to installed. */
async function mockHooks(page, initialStatus, extra = {}) {
  const state = { status: initialStatus, installCalls: 0 };
  await page.route('**/api/claude-hooks', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hookStatus(state.status, state.status === initialStatus ? extra : {})),
    }));
  await page.route('**/api/claude-hooks/install', route => {
    state.installCalls += 1;
    state.status = 'installed';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hookStatus('installed')) });
  });
  await page.route('**/api/claude-sessions', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hookConfigured: state.status === 'installed', sessions: [] }),
    }));
  return state;
}

test.describe('Claude Code status control', () => {
  test('Enable installs the hooks and reveals the Claude column without a reload', async ({ page }) => {
    const state = await mockHooks(page, 'not-installed');
    await page.goto('/');
    await page.waitForSelector('.workspace-table', { timeout: 10000 });

    await expect(page.locator('th:has-text("Claude")')).not.toBeVisible();
    await expect(page.locator('.claude-hook-banner')).not.toBeVisible();

    await page.getByRole('button', { name: 'Enable Claude Code status' }).click();

    await expect(page.locator('th:has-text("Claude")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Disable Claude Code status' })).toBeVisible();
    expect(state.installCalls).toBe(1);
  });

  test('a broken install shows the repair banner; Repair fixes it', async ({ page }) => {
    await mockHooks(page, 'needs-repair', {
      legacy: true,
      reason: 'Hooks point at a script from a repository checkout (old install method).',
    });

    await page.goto('/');
    const banner = page.locator('.claude-hook-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('repository checkout');

    await banner.getByRole('button', { name: 'Repair' }).click();
    await expect(banner).not.toBeVisible();
    await expect(page.locator('th:has-text("Claude")')).toBeVisible({ timeout: 10000 });
  });
});
