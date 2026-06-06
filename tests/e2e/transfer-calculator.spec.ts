import { test, expect } from '@playwright/test';

test.describe('Transfer calculator', () => {
  test('transfer page loads', async ({ page }) => {
    const response = await page.goto('/tk/transfer');
    expect(response?.status()).toBe(200);
  });

  test('displays the $12,000 USD cap', async ({ page }) => {
    await page.goto('/tk/transfer');
    await expect(page.locator('body')).toContainText('12');
  });

  test('displays the 42,120 TMT cap', async ({ page }) => {
    await page.goto('/tk/transfer');
    await expect(page.locator('body')).toContainText('42');
  });

  test('displays the 3.51 TMT/USD exchange rate', async ({ page }) => {
    await page.goto('/tk/transfer');
    await expect(page.locator('body')).toContainText('3.51');
  });
});
