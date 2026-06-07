/**
 * E2E tests for table UX interactions:
 * adjacent-pair column resizing, drag-to-reorder, expandable path cells
 */
const { test, expect } = require('@playwright/test');

const headerKeys = (page) =>
  page.locator('thead th').evaluateAll(els => els.map(el => el.dataset.columnKey));

const headerWidth = async (page, key) => {
  const box = await page.locator(`th[data-column-key="${key}"]`).boundingBox();
  return box.width;
};

test.describe('Spec: Adjacent-pair column resizing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table', { timeout: 15000 });
  });

  test('dragging a handle trades width within the pair and leaves other columns untouched', async ({ page }) => {
    const nameBefore = await headerWidth(page, 'name');
    const lastBefore = await headerWidth(page, 'lastAccessed');
    const typeBefore = await headerWidth(page, 'type');
    const connBefore = await headerWidth(page, 'connection');

    const handle = page.locator('th[data-column-key="name"] .resize-handle');
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2, { steps: 5 });
    await page.mouse.up();

    const tolerance = 2;
    expect(Math.abs((await headerWidth(page, 'name')) - (nameBefore + 60))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((await headerWidth(page, 'lastAccessed')) - (lastBefore - 60))).toBeLessThanOrEqual(tolerance);
    // the rest of the table does not reflow
    expect(Math.abs((await headerWidth(page, 'type')) - typeBefore)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((await headerWidth(page, 'connection')) - connBefore)).toBeLessThanOrEqual(tolerance);
  });

  test('the last visible column has no resize handle', async ({ page }) => {
    const keys = await headerKeys(page);
    const lastKey = keys[keys.length - 1];
    await expect(page.locator(`th[data-column-key="${lastKey}"] .resize-handle`)).toHaveCount(0);
  });

  test('releasing a resize does not change the sort', async ({ page }) => {
    const indicatorBefore = await page.locator('thead tr').textContent();

    const handle = page.locator('th[data-column-key="name"] .resize-handle');
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2, { steps: 5 });
    await page.mouse.up();

    // sort indicators (▲/▼) unchanged
    expect(await page.locator('thead tr').textContent()).toBe(indicatorBefore);
  });
});

test.describe('Spec: Drag-to-reorder columns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table', { timeout: 15000 });
  });

  test('dragging a header reorders the column and the order survives a reload', async ({ page }) => {
    const before = await headerKeys(page);
    expect(before.indexOf('name')).toBeLessThan(before.indexOf('lastAccessed'));

    // drag the Name header to the right, past Last Accessed's midpoint
    const nameBox = await page.locator('th[data-column-key="name"]').boundingBox();
    const lastBox = await page.locator('th[data-column-key="lastAccessed"]').boundingBox();
    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(lastBox.x + lastBox.width - 5, nameBox.y + nameBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const after = await headerKeys(page);
    expect(after.indexOf('lastAccessed')).toBeLessThan(after.indexOf('name'));
    expect(after[0]).toBe('select'); // pinned

    await page.reload();
    await page.waitForSelector('table', { timeout: 15000 });
    const reloaded = await headerKeys(page);
    expect(reloaded.indexOf('lastAccessed')).toBeLessThan(reloaded.indexOf('name'));
  });

  test('a plain header click still sorts', async ({ page }) => {
    await page.locator('th[data-column-key="name"]').click();
    await expect(page.locator('th[data-column-key="name"]')).toContainText(/[▲▼]/);
  });
});

test.describe('Spec: Expandable path cells with copy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table', { timeout: 15000 });
  });

  test('clicking a path cell expands it and shows a copy button', async ({ page, context, browserName }) => {
    const cell = page.locator('td.workspace-extracted-path').first();
    if ((await cell.count()) === 0 || !(await cell.textContent()).trim()) {
      test.skip(true, 'no workspaces with paths on this machine');
    }

    await cell.click();
    await expect(cell).toHaveClass(/cell-expanded/);

    const copyBtn = cell.locator('.cell-copy-btn');
    await expect(copyBtn).toBeVisible();

    if (browserName === 'chromium') {
      // clipboard permissions are reliable in chromium only
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await copyBtn.click();
      await expect(copyBtn).toHaveText('✓');
      await expect(cell).toHaveClass(/cell-expanded/); // copy does not collapse
    }

    // clicking the cell again collapses it
    await cell.click();
    await expect(cell).not.toHaveClass(/cell-expanded/);
  });
});
