import { test, expect } from '@playwright/test';

test.describe('Admin authentication', () => {
  test('redirects unauthenticated user from /admin to /admin/signin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin/signin');
  });

  test('shows error on invalid email format', async ({ page }) => {
    await page.goto('/admin/signin');
    await page.fill('[name="email"]', 'not-an-email');
    await page.fill('[name="password"]', 'somepassword');
    await page.click('[type="submit"]');
    await expect(page.locator('text=/invalid email/i')).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/admin/signin');
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('[type="submit"]');
    await expect(page.locator('text=/invalid email or password/i')).toBeVisible();
  });

  test('signs out and blocks access to /admin', async ({ page, context }) => {
    // This test requires a valid admin account — set via env vars in CI
    test.skip(!process.env.TEST_ADMIN_EMAIL, 'TEST_ADMIN_EMAIL not set');

    await page.goto('/admin/signin');
    await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL('/admin');

    // Sign out
    await page.click('text=Sign out');
    await expect(page).toHaveURL('/admin/signin');

    // Access denied after sign out
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin/signin');
  });
});
