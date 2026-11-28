/**
 * M3 · Accounts, with local stand-ins only: email codes come from the local dev
 * mailbox (/api/dev/mailbox), Telegram login data is signed with the made-up
 * token in .dev.vars, Google isn't configured locally (its button is hidden).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { signLoginWidget } from '../../src/lib/auth/telegram.ts';
import {
  codeFor,
  ownIpPerTest,
  signInByEmail,
  signInOnPage,
  testIp,
  uniqueEmail,
} from './account.ts';
import { fill, hasNoHorizontalOverflow, msg } from './helpers.ts';

const PROGRAM = '/en/programs/demo-u1-business-administration';
const PROGRAM_NAME = 'Business Administration';

ownIpPerTest();

function devToken(): string {
  const vars = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
  const token = /^TELEGRAM_BOT_TOKEN=(.+)$/m.exec(vars)?.[1];
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing from .dev.vars (copy .dev.vars.example)');
  return token.trim();
}

/**
 * Does what the Login Widget does: opens our Telegram page (telegram.org is
 * blocked, so nothing leaves the machine), takes the return URL from the widget
 * (it holds the one-time state our page set in a cookie), and adds signed data.
 */
async function telegramSignIn(page: Page, id: string, token = devToken()) {
  await page.route('https://telegram.org/**', (route) => route.abort());
  await page.goto('/en/sign-in/telegram');
  const authUrl = await page.locator('script[data-telegram-login]').getAttribute('data-auth-url');
  if (!authUrl) throw new Error('No Telegram widget on the page');
  const url = new URL(authUrl);
  const signed = await signLoginWidget(
    { id, first_name: 'Test', auth_date: String(Math.floor(Date.now() / 1000)) },
    token,
  );
  for (const [key, value] of signed) url.searchParams.set(key, value);
  await page.goto(`${url.pathname}${url.search}`);
}

test.describe('sign-in page', () => {
  test('methods in order Telegram, email, Google (Google hidden without keys); no overflow', async ({
    page,
  }) => {
    await page.goto('/en/sign-in');
    const telegram = page.getByRole('link', { name: msg('en', 'signIn.telegram') });
    const email = page.getByRole('button', { name: msg('en', 'signIn.email') });
    await expect(telegram).toBeVisible();
    await expect(email).toBeVisible();
    const [t, e] = await Promise.all([telegram.boundingBox(), email.boundingBox()]);
    expect(t && e && t.y < e.y).toBe(true);
    await expect(page.getByRole('button', { name: msg('en', 'signIn.google') })).toHaveCount(0);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('a wrong code is refused with a clear message', async ({ page }, info) => {
    const email = uniqueEmail(info, 'wrong');
    await page.goto('/en/sign-in');
    await page.getByLabel(msg('en', 'signIn.emailLabel')).fill(email);
    await page.getByRole('button', { name: msg('en', 'signIn.email') }).click();
    const code = await codeFor(page, email);
    await page
      .getByLabel(msg('en', 'signIn.codeLabel'))
      .fill(code === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: msg('en', 'signIn.verify'), exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(msg('en', 'signIn.error.code'));
  });

  test('too many code requests: a clear error', async ({ page, baseURL }, info) => {
    const email = uniqueEmail(info, 'limit');
    for (let i = 0; i < 10; i++) {
      await page.request.post('/api/auth/email-otp/send-verification-otp', {
        data: { email, type: 'sign-in' },
        headers: { Origin: baseURL ?? '', 'CF-Connecting-IP': testIp(info) },
      });
    }
    await page.goto('/en/sign-in');
    await page.getByLabel(msg('en', 'signIn.emailLabel')).fill(email);
    await page.getByRole('button', { name: msg('en', 'signIn.email') }).click();
    await expect(page.getByRole('alert')).toHaveText(msg('en', 'signIn.error.rate'));
  });
});

test.describe('JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('sign in with an email code, then sign out', async ({ page }, info) => {
    await signInByEmail(page, uniqueEmail(info, 'nojs'));
    await expect(
      page.getByRole('heading', { level: 1, name: msg('en', 'my.title') }),
    ).toBeVisible();
    await page.goto('/en/my/profile');
    await page.getByRole('button', { name: msg('en', 'profile.signOut') }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto('/en/my');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fmy/);
  });

  test('Save resumes after sign-in', async ({ page }, info) => {
    await page.goto(PROGRAM);
    await page.getByRole('button', { name: msg('en', 'save.save') }).click();
    await expect(page.getByText(msg('en', 'signIn.why.save'))).toBeVisible();
    await signInOnPage(page, uniqueEmail(info, 'resume'));
    await expect(page).toHaveURL(new RegExp(`${PROGRAM}$`));
    await page.goto('/en/my/saved');
    await expect(page.getByRole('link', { name: PROGRAM_NAME })).toBeVisible();
    // Remove it again from the Saved tab.
    await page
      .getByRole('button', { name: fill('en', 'my.saved.removeLabel', { name: PROGRAM_NAME }) })
      .click();
    await expect(page.getByText(msg('en', 'my.saved.empty.title'))).toBeVisible();
  });
});

test.describe('Save with the sign-in sheet', () => {
  test('signed out: the sheet opens, email sign-in, then it is saved', async ({ page }, info) => {
    const email = uniqueEmail(info, 'sheet');
    await page.goto(PROGRAM);
    const island = page
      .locator('astro-island:not([ssr])')
      .filter({ has: page.locator('.save-form') });
    await expect(island).toHaveCount(1);
    const save = page.getByRole('button', { name: msg('en', 'save.save') });
    await save.click();

    const sheet = page.getByRole('dialog', { name: msg('en', 'signIn.title') });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(msg('en', 'signIn.why.save'))).toBeVisible();
    await sheet.getByLabel(msg('en', 'signIn.emailLabel')).fill(email);
    await sheet.getByRole('button', { name: msg('en', 'signIn.email') }).click();
    await sheet.getByLabel(msg('en', 'signIn.codeLabel')).fill(await codeFor(page, email));
    await sheet.getByRole('button', { name: msg('en', 'signIn.verify'), exact: true }).click();

    await expect(sheet).toBeHidden();
    // The label says it ("Saved"), so the button doesn't also use aria-pressed.
    await expect(page.getByRole('button', { name: msg('en', 'save.saved') })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: msg('en', 'save.saved') })).toBeVisible();
    await page.getByRole('button', { name: msg('en', 'save.saved') }).click();
    await expect(page.getByRole('button', { name: msg('en', 'save.save') })).toBeVisible();
  });

  test('Escape closes the sheet; nothing is saved', async ({ page }) => {
    await page.goto(PROGRAM);
    await expect(
      page.locator('astro-island:not([ssr])').filter({ has: page.locator('.save-form') }),
    ).toHaveCount(1);
    await page.getByRole('button', { name: msg('en', 'save.save') }).click();
    const sheet = page.getByRole('dialog', { name: msg('en', 'signIn.title') });
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: msg('en', 'save.save') })).toBeVisible();
  });
});

test.describe('Telegram (local stand-in token)', () => {
  test('signed login data signs in', async ({ page }, info) => {
    const telegramId = String(800_000_000 + Math.floor(Math.random() * 1_000_000) + info.retry);
    await telegramSignIn(page, telegramId);
    await expect(page).toHaveURL(/\/en\/my$/);
    await expect(
      page.getByRole('heading', { level: 1, name: msg('en', 'my.title') }),
    ).toBeVisible();
    await page.goto('/en/my/profile');
    await expect(page.getByText(msg('en', 'profile.method.linked'))).toBeVisible();
    // No real email yet: email reminders need one.
    await expect(page.getByText(msg('en', 'profile.reminder.needsEmail'))).toBeVisible();
  });

  test('a link that did not start on our Telegram page is refused', async ({ page }) => {
    const signed = await signLoginWidget(
      { id: '800998', auth_date: String(Math.floor(Date.now() / 1000)) },
      devToken(),
    );
    signed.set('next', '/en/auth/continue');
    signed.set('fail', '/en/sign-in');
    await page.goto(`/api/auth/telegram/callback?${signed}`);
    await expect(page).toHaveURL(/\/en\/sign-in\?error=telegram-failed/);
    await page.goto('/en/my');
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test('data signed with another token is refused', async ({ page }) => {
    await telegramSignIn(page, '800999', '1:not-the-bot');
    await expect(page).toHaveURL(/\/en\/sign-in\?error=telegram-failed/);
    await expect(page.getByRole('alert')).toHaveText(msg('en', 'signIn.error.telegram-failed'));
  });
});

test.describe('Profile', () => {
  test('language and theme; the theme follows to cached pages', async ({ page }, info) => {
    await signInByEmail(page, uniqueEmail(info, 'theme'));
    await page.goto('/en/my/profile');
    await page.getByRole('radio', { name: 'Русский' }).check();
    await page.getByRole('radio', { name: msg('en', 'profile.theme.dark') }).check();
    await page.getByRole('button', { name: msg('en', 'profile.save') }).click();
    await expect(page).toHaveURL(/\/ru\/my\/profile\?updated=1$/);
    await expect(page.getByRole('status')).toHaveText(msg('ru', 'profile.updated'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto('/ru');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // `/` now opens Russian.
    await page.goto('/');
    await expect(page).toHaveURL(/\/ru$/);
  });

  test('deleting the account removes everything', async ({ page }, info) => {
    const email = uniqueEmail(info, 'delete');
    await signInByEmail(page, email);
    await page.request.post('/api/save', {
      data: { type: 'program', id: 101, saved: true, lang: 'en' },
    });
    await page.goto('/en/my/saved');
    await expect(page.getByRole('link', { name: PROGRAM_NAME })).toBeVisible();

    await page.goto('/en/my/profile');
    await page.getByRole('button', { name: msg('en', 'profile.delete.button') }).click();
    // The checkbox is required.
    await expect(page).toHaveURL(/\/en\/my\/profile$/);
    await page.getByLabel(msg('en', 'profile.delete.confirm')).check();
    await page.getByRole('button', { name: msg('en', 'profile.delete.button') }).click();
    await expect(page).toHaveURL(/\/en\/account-deleted$/);
    await expect(page.getByText(msg('en', 'deleted.body'))).toBeVisible();

    // Signed out, and the same email starts over with nothing saved.
    await page.goto('/en/my/saved');
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await signInOnPage(page, email);
    await page.goto('/en/my/saved');
    await expect(page.getByText(msg('en', 'my.saved.empty.title'))).toBeVisible();
  });
});

test.describe('Matches for you', () => {
  test('quick questions show matching programs and are remembered', async ({ page }) => {
    await page.goto('/en');
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: msg('en', 'quiz.title') }),
    });
    await expect(section.locator('astro-island:not([ssr])')).toHaveCount(1);
    await section.getByText(msg('en', 'quiz.start')).click();
    await section.getByRole('checkbox').first().check();
    await section.getByRole('button', { name: msg('en', 'quiz.show') }).click();
    await expect(section.locator('.program-card').first()).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.reload();
    const again = page.locator('section', {
      has: page.getByRole('heading', { name: msg('en', 'quiz.title') }),
    });
    await expect(again.locator('.program-card').first()).toBeVisible();
    await expect(again.getByText(msg('en', 'quiz.edit'))).toBeVisible();
  });

  test.describe('JavaScript off', () => {
    test.use({ javaScriptEnabled: false });
    test('the questions are a search form', async ({ page }) => {
      await page.goto('/en');
      await page.getByText(msg('en', 'quiz.start')).click();
      await page.getByRole('button', { name: msg('en', 'quiz.show') }).click();
      await expect(page).toHaveURL(/\/en\/search\?level=bachelor/);
    });
  });
});

test.describe('account pages', () => {
  test('never cached, kept out of search engines; My Clav needs sign-in', async ({
    page,
  }, info) => {
    await page.goto('/en/my');
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fmy$/);
    const signIn = await page.request.get('/en/sign-in');
    expect(signIn.headers()['cache-control']).toBe('private, no-store');
    await signInByEmail(page, uniqueEmail(info, 'headers'));
    for (const path of ['/en/my', '/en/my/saved', '/en/my/profile']) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cache-control'], path).toBe('private, no-store');
      expect(await response.text(), path).toContain('<meta name="robots" content="noindex">');
    }
    const me = await page.request.get('/api/me');
    expect(me.headers()['cache-control']).toBe('private, no-store');
  });
});
