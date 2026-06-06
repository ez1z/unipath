import { test, expect } from '@playwright/test';

test.describe('University comparison page', () => {
  test('compare page loads without ids', async ({ page }) => {
    const response = await page.goto('/tk/compare');
    expect(response?.status()).toBe(200);
  });

  test('compare page with invalid ids does not crash', async ({ page }) => {
    const response = await page.goto('/tk/compare?ids=invalid-id');
    expect(response?.status()).not.toBe(500);
  });
});
