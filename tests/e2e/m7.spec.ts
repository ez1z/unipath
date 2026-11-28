/**
 * M7 checks in the browser (SPEC): an admin edit shows on the public page on
 * the next load without a rebuild. Also: who may open /admin, the publish
 * rule, and a logo upload resized to WebP in the browser. The import and
 * backup checks are in m7-scripts.spec.ts.
 */
import { expect, test } from '@playwright/test';
import { ownIpPerTest, signInByEmail, uniqueEmail } from './account.ts';
import { pngFromBrowser, signInAsAdmin } from './admin.ts';
import { msg } from './helpers.ts';

ownIpPerTest();

test('signed out, /admin asks to sign in; students get a plain 404', async ({ page }, info) => {
  await page.goto('/admin/universities');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Funiversities/);

  await signInByEmail(page, uniqueEmail(info, 'student'));
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['cache-control']).toContain('no-store');
});

test('an admin edit shows on the cached public page at the next load', async ({ page }, info) => {
  // Each project edits its own university so the two runs don't meet.
  const n = info.project.name === 'phone' ? 7 : 8;
  const city = n === 7 ? 'Manchester' : 'Leeds';
  const edited = `${city} E2E ${Date.now()}`;
  const publicPath = `/en/universities/demo-university-${n}`;

  await signInAsAdmin(page, uniqueEmail(info, 'admin'));
  // Warm the page cache with the old city.
  await page.goto(publicPath);
  await expect(page.getByText(`${city}, `)).toBeVisible();

  await page.goto(`/admin/universities?q=${encodeURIComponent(`Demo University ${n}`)}`);
  await page.getByRole('link', { name: `Demo University ${n}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Demo University ${n}` })).toBeVisible();

  const cityField = page.getByLabel(msg('en', 'admin.field.city'));
  try {
    await cityField.fill(edited);
    // Logo: picked as a PNG, resized and sent as WebP by the browser.
    // The upload island hydrates when it scrolls into view (client:visible).
    const island = page
      .locator('astro-island')
      .filter({ has: page.locator('input[type=file]') })
      .first();
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr');
    await island.locator('input[type=file]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: await pngFromBrowser(page),
    });
    await expect(page.getByText(msg('en', 'admin.image.done')).first()).toBeVisible();
    await page.getByRole('button', { name: msg('en', 'admin.save'), exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: msg('en', 'admin.saved') }),
    ).toBeVisible();

    await page.goto(publicPath);
    await expect(page.getByText(`${edited}, `)).toBeVisible();
    const logo = page.locator('img.logo');
    await expect(logo).toHaveAttribute('src', /^\/files\/logos\/[0-9a-f-]{36}\.webp$/);
    const file = await page.request.get((await logo.getAttribute('src')) ?? '');
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toBe('image/webp');
    expect(file.headers()['cache-control']).toContain('immutable');

    // The change is in the audit log.
    await page.goto('/admin/audit?type=university&id=' + n);
    await expect(page.getByText('update').first()).toBeVisible();
  } finally {
    await page.goto(`/admin/universities/${n}`);
    await page.getByLabel(msg('en', 'admin.field.city')).fill(city);
    const remove = page.getByRole('button', { name: msg('en', 'admin.image.remove') });
    if (await remove.count()) await remove.first().click();
    await page.getByRole('button', { name: msg('en', 'admin.save'), exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: msg('en', 'admin.saved') }),
    ).toBeVisible();
  }
});

test('a record needs a source before it can be published', async ({ page }, info) => {
  await signInAsAdmin(page, uniqueEmail(info, 'admin-src'));
  await page.goto('/admin/colleges/new');
  await page.getByLabel('English').fill('Unsourced College');
  await page.getByLabel(msg('en', 'admin.field.city')).fill('Nowhere');
  await page.getByLabel(msg('en', 'admin.field.country')).selectOption('GB');
  await page.getByLabel(msg('en', 'admin.field.published')).check();
  await page.getByRole('button', { name: msg('en', 'admin.create') }).click();
  // The message shows by the field, and the summary at the top links to that field.
  await expect(
    page.locator('form').getByText(msg('en', 'admin.error.publishNeedsSource')),
  ).toBeVisible();
  await expect(
    page.getByRole('alert').getByRole('link', { name: msg('en', 'admin.field.sourceUrl') }),
  ).toHaveAttribute('href', '#f-source_url');
  await expect(page.getByLabel(msg('en', 'admin.field.sourceUrl'))).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
