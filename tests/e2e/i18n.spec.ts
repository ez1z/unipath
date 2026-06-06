import { test, expect } from '@playwright/test';

test.describe('i18n routing', () => {
  test('root / redirects to default locale /tk', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tk/);
  });

  test('/tk/universities loads without error', async ({ page }) => {
    const response = await page.goto('/tk/universities');
    expect(response?.status()).toBe(200);
  });

  test('/ru/universities loads without error', async ({ page }) => {
    const response = await page.goto('/ru/universities');
    expect(response?.status()).toBe(200);
  });

  test('/en/universities loads without error', async ({ page }) => {
    const response = await page.goto('/en/universities');
    expect(response?.status()).toBe(200);
  });

  test('unknown locale falls back or 404s gracefully', async ({ page }) => {
    const response = await page.goto('/xx/universities');
    // Either redirected to a valid locale or 404 — must not be 500
    expect(response?.status()).not.toBe(500);
  });
});
