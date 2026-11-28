/**
 * M4 · Tracker: track a pathway, tick tasks, change stage, share a read-only
 * page with parents and open it signed out. Reminder sending is covered by the
 * cron unit test (tests/unit/tracker.test.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { ownIpPerTest, signInByEmail, signInOnPage, uniqueEmail } from './account.ts';
import { fill, hasNoHorizontalOverflow, isPhone, msg } from './helpers.ts';

ownIpPerTest();

/** Foundation Year 203 → International Relations 201 (pathway 3). */
const FOUNDATION = '/en/programs/demo-u2-foundation-year';
const BACHELOR_NAME = 'International Relations';

async function trackFoundationPath(page: Page) {
  await page.goto(FOUNDATION);
  await page.getByRole('button', { name: new RegExp(`^${msg('en', 'track.path')}`) }).click();
  await expect(page).toHaveURL(/\/en\/my\/tracker\/\d+$/);
  await expect(page.getByRole('heading', { level: 2, name: BACHELOR_NAME })).toBeVisible();
}

const progress = (done: number, total: number) => fill('en', 'tracker.progress', { done, total });

test('track a pathway, tick tasks, change stage, share with parents', async ({
  page,
  browser,
}, info) => {
  await signInByEmail(page, uniqueEmail(info, 'tracker'));
  await trackFoundationPath(page);
  await expect(page.getByText(msg('en', 'tracker.type.pathway'))).toBeVisible();
  // Two steps and the total, as a fact.
  await expect(page.getByText('5 years total')).toBeVisible();

  // The pre-filled checklist: tick the first task.
  const tasks = page.locator('.task-button');
  const total = await tasks.count();
  expect(total).toBeGreaterThan(2);
  await expect(page.getByText(progress(0, total))).toBeVisible();
  await tasks.first().click();
  await expect(tasks.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(progress(1, total))).toBeVisible();

  // Stage on the item page (a plain form).
  await page
    .getByRole('combobox', { name: msg('en', 'tracker.stage'), exact: true })
    .selectOption('preparing');
  await page.getByRole('button', { name: msg('en', 'tracker.change') }).click();
  await expect(
    page.getByRole('combobox', { name: msg('en', 'tracker.stage'), exact: true }),
  ).toHaveValue('preparing');

  // Notes stay private.
  await page
    .getByRole('textbox', { name: msg('en', 'tracker.notes'), exact: true })
    .fill('Ask about the stamp');
  await page.getByRole('button', { name: msg('en', 'tracker.saveNotes') }).click();
  await expect(
    page.getByRole('textbox', { name: msg('en', 'tracker.notes'), exact: true }),
  ).toHaveValue('Ask about the stamp');

  // The board: the card is under Preparing; the menu saves without a reload.
  await page.goto('/en/my');
  const preparing = page.getByRole('region', { name: /^Preparing/ });
  await expect(preparing.getByRole('link', { name: BACHELOR_NAME })).toBeVisible();
  const menu = page.getByLabel(fill('en', 'tracker.moveTo', { name: BACHELOR_NAME }));
  await expect(page.getByRole('button', { name: msg('en', 'tracker.change') })).toHaveCount(0);
  await menu.selectOption('submitted');
  await expect(page.locator('.tracker-board').getByRole('status')).toContainText(
    msg('en', 'tracker.saved'),
  );
  await page.reload();
  await expect(
    page.getByRole('region', { name: /^Submitted/ }).getByRole('link', { name: BACHELOR_NAME }),
  ).toBeVisible();
  expect(await hasNoHorizontalOverflow(page)).toBe(true);

  // Share the whole tracker in Russian.
  await page.getByRole('link', { name: msg('en', 'share.cta') }).click();
  await page.getByLabel(msg('en', 'share.scope.tracker')).check();
  await page.getByLabel(msg('en', 'share.parentLang')).selectOption('ru');
  await page.getByRole('button', { name: msg('en', 'share.create') }).click();
  await expect(page.getByText(msg('en', 'share.created'))).toBeVisible();
  const url = await page.locator('.created').getByLabel(msg('en', 'share.linkLabel')).inputValue();
  expect(url).toMatch(/\/ru\/share\/[A-Za-z0-9_-]{43}$/);
  const sharePath = new URL(url).pathname;

  // A parent opens it without signing in.
  const parent = await browser.newContext();
  const parentPage = await parent.newPage();
  const response = await parentPage.goto(sharePath);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(
    parentPage.getByRole('heading', { level: 1, name: msg('ru', 'shared.title') }),
  ).toBeVisible();
  await expect(parentPage.getByText(msg('ru', 'stage.submitted'))).toBeVisible();
  await expect(parentPage.getByText('Ask about the stamp')).toHaveCount(0);
  // Read only: nothing on it writes.
  await expect(parentPage.locator('form[action^="/api/"]')).toHaveCount(0);

  // Stopping the link: the parent page is gone.
  await page.getByRole('button', { name: msg('en', 'share.revoke') }).click();
  await expect(page.getByText(msg('en', 'share.none'))).toBeVisible();
  const gone = await parentPage.goto(sharePath);
  expect(gone?.status()).toBe(404);
  await expect(parentPage.getByRole('heading', { name: msg('ru', 'shared.gone') })).toBeVisible();
  await parent.close();
});

test.describe('JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('Track while signed out: sign in, and the item is tracked', async ({ page }, info) => {
    await page.goto(FOUNDATION);
    await page.getByRole('button', { name: new RegExp(`^${msg('en', 'track.path')}`) }).click();
    await signInOnPage(page, uniqueEmail(info, 'track-later'));
    await expect(page).toHaveURL(/\/en\/my\/tracker\/\d+$/);
    await expect(page.getByRole('heading', { level: 2, name: BACHELOR_NAME })).toBeVisible();

    // The board works as plain forms too.
    await page.goto('/en/my');
    await page
      .getByLabel(fill('en', 'tracker.moveTo', { name: BACHELOR_NAME }))
      .selectOption('accepted');
    await page.getByRole('button', { name: msg('en', 'tracker.change') }).click();
    await expect(
      page.getByRole('region', { name: /^Decision/ }).getByRole('link', { name: BACHELOR_NAME }),
    ).toBeVisible();

    // Stop tracking (needs the confirmation box).
    await page.getByRole('link', { name: BACHELOR_NAME }).click();
    await page.getByLabel(msg('en', 'tracker.stopConfirm')).check();
    await page.getByRole('button', { name: msg('en', 'tracker.stop') }).click();
    await expect(page).toHaveURL(/\/en\/my$/);
    await expect(page.getByText(msg('en', 'my.tracker.empty.title'))).toBeVisible();
  });
});

test('desktop: drag a card to another column', async ({ page }, info) => {
  test.skip(isPhone(info.project.name), 'Dragging is the desktop shortcut');
  await signInByEmail(page, uniqueEmail(info, 'drag'));
  await trackFoundationPath(page);
  await page.goto('/en/my');
  const card = page.locator('.board-card', { hasText: BACHELOR_NAME });
  await expect(card).toHaveAttribute('draggable', 'true');
  await card.dragTo(page.getByRole('region', { name: /^Preparing/ }));
  await expect(page.locator('.tracker-board').getByRole('status')).toContainText(
    msg('en', 'tracker.saved'),
  );
  await page.reload();
  await expect(
    page.getByRole('region', { name: /^Preparing/ }).getByRole('link', { name: BACHELOR_NAME }),
  ).toBeVisible();
});

test('signed in, Home shows the next deadline', async ({ page }, info) => {
  await signInByEmail(page, uniqueEmail(info, 'home'));
  await trackFoundationPath(page);
  await page.goto('/en');
  const card = page.locator('.next-card');
  await expect(card).toContainText(msg('en', 'tracker.next'));
  await expect(card).toContainText(BACHELOR_NAME);
  await card.click();
  await expect(page).toHaveURL(/\/en\/my\/tracker\/\d+$/);
});

test("someone else's tracker item is not found", async ({ page, browser }, info) => {
  await signInByEmail(page, uniqueEmail(info, 'owner'));
  await trackFoundationPath(page);
  const itemPath = new URL(page.url()).pathname;

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signInByEmail(otherPage, uniqueEmail(info, 'other'));
  const response = await otherPage.goto(itemPath);
  expect(response?.status()).toBe(404);
  const id = Number(itemPath.split('/').pop());
  const write = await otherPage.request.post('/api/tracker/item', {
    data: { action: 'stage', id, stage: 'enrolled', lang: 'en' },
  });
  expect(write.status()).toBe(404);
  await other.close();
});
