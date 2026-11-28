/**
 * M6 · Telegram Mini App, with local stand-ins: launch data signed with the
 * made-up bot token in .dev.vars, and a fake `TelegramWebviewProxy` that
 * records the events the page sends to "Telegram". The real app is checked by
 * hand (docs/manual-checks.md, M6).
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { signInitData } from '../../src/lib/auth/telegram.ts';
import { ownIpPerTest } from './account.ts';
import { msg } from './helpers.ts';

ownIpPerTest();

function botToken(): string {
  const vars = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
  const token = /^TELEGRAM_BOT_TOKEN=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing from .dev.vars (copy .dev.vars.example)');
  return token;
}

/** A Telegram id of its own for each test run, so nothing is shared between tests. */
function telegramId(info: TestInfo): number {
  let hash = 0;
  for (const c of `${info.project.name}/${info.testId}/${info.retry}/${Date.now()}`) {
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  }
  return 200_000_000 + (hash % 100_000_000);
}

const THEMES = {
  light: { bg_color: '#ffffff', text_color: '#000000' },
  dark: { bg_color: '#17212b', text_color: '#f5f5f5' },
};

async function launchUrl(
  id: number,
  { lang = 'ru', theme = 'light' as keyof typeof THEMES, tamper = false } = {},
): Promise<string> {
  let initData = await signInitData(
    {
      user: JSON.stringify({ id, first_name: 'Test', language_code: lang }),
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: 'e2e',
    },
    botToken(),
  );
  if (tamper) {
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ id: id + 1, language_code: lang }));
    initData = params.toString();
  }
  const hash = new URLSearchParams({
    tgWebAppData: initData,
    tgWebAppVersion: '8.0',
    tgWebAppPlatform: 'android',
    tgWebAppThemeParams: JSON.stringify(THEMES[theme]),
  });
  return `/tg#${hash.toString()}`;
}

interface TgEvent {
  type: string;
  data: unknown;
  path: string;
}

/** Pretends to be the Telegram app: records every event the page posts. */
async function fakeTelegram(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { TelegramWebviewProxy: unknown }).TelegramWebviewProxy = {
      postEvent(type: string, data: string) {
        const log = JSON.parse(sessionStorage.getItem('e2e_tg_events') ?? '[]') as unknown[];
        log.push({
          type,
          data: data ? (JSON.parse(data) as unknown) : null,
          path: location.pathname,
        });
        sessionStorage.setItem('e2e_tg_events', JSON.stringify(log));
      },
    };
  });
}

async function events(page: Page, path?: string): Promise<TgEvent[]> {
  const all = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('e2e_tg_events') ?? '[]') as TgEvent[],
  );
  return path ? all.filter((e) => e.path === path) : all;
}

/** Telegram sending an event to the page. */
async function fromTelegram(page: Page, type: string, data?: unknown) {
  await page.evaluate(
    ([t, d]) => {
      (
        window as unknown as {
          Telegram: { WebView: { receiveEvent(t: string, d: unknown): void } };
        }
      ).Telegram.WebView.receiveEvent(t as string, d);
    },
    [type, data] as const,
  );
}

test('opening from the bot signs in silently, in Telegram’s language', async ({ page }, info) => {
  await fakeTelegram(page);
  await page.goto(await launchUrl(telegramId(info), { lang: 'ru' }));
  await expect(page).toHaveURL(/\/ru$/);

  // Signed in: My Clav opens instead of the sign-in page.
  await page.goto('/ru/my');
  await expect(page).toHaveURL(/\/ru\/my$/);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'clavis.session_token')?.httpOnly).toBe(true);
  expect(cookies.find((c) => c.name === 'clavis_lang')?.value).toBe('ru');
});

test('a returning student keeps their Profile language', async ({ page, browser }, info) => {
  const id = telegramId(info);
  await fakeTelegram(page);
  await page.goto(await launchUrl(id, { lang: 'ru' }));
  await expect(page).toHaveURL(/\/ru$/);
  await page.goto('/ru/my/profile');
  await page.getByLabel('English', { exact: true }).check();
  await page.getByRole('button', { name: msg('ru', 'profile.save') }).click();

  // Next time Telegram still says Russian, but the student chose English.
  const later = await browser.newContext();
  const again = await later.newPage();
  await fakeTelegram(again);
  await again.goto(await launchUrl(id, { lang: 'ru' }));
  await expect(again).toHaveURL(/\/en$/);
  await later.close();
});

test('tampered launch data is refused', async ({ page }, info) => {
  await fakeTelegram(page);
  await page.goto(await launchUrl(telegramId(info), { tamper: true }));
  await expect(page).toHaveURL(/\/tk\/sign-in\?error=telegram-app$/);
  await expect(page.getByText(msg('tk', 'signIn.error.telegram-app'))).toBeVisible();
  expect(
    (await page.context().cookies()).find((c) => c.name === 'clavis.session_token'),
  ).toBeUndefined();
});

test('a link with someone’s launch data signs no one in outside Telegram', async ({
  page,
}, info) => {
  // Valid, signed data, but a plain browser (no Telegram bridge): a login CSRF attempt.
  await page.goto(await launchUrl(telegramId(info), { lang: 'ru' }));
  await expect(page.getByText(msg('tk', 'tg.outside'))).toBeVisible();
  await expect(page).toHaveURL(/\/tg#/);
  expect(
    (await page.context().cookies()).find((c) => c.name === 'clavis.session_token'),
  ).toBeUndefined();
  // And a hash on any other page is ignored.
  await page.goto(`/en${(await launchUrl(telegramId(info))).slice(3)}`);
  expect(await page.evaluate(() => sessionStorage.getItem('clavis_tg'))).toBeNull();
});

test('opened outside Telegram, /tg says so and links to the website', async ({ page }) => {
  await page.goto('/tg');
  await expect(page.getByText(msg('tk', 'tg.outside'))).toBeVisible();
  await expect(page.getByRole('link', { name: msg('tk', 'tg.toSite') })).toHaveAttribute(
    'href',
    '/tk',
  );
});

test('ready, expand, back button and Telegram’s colours', async ({ page }, info) => {
  await fakeTelegram(page);
  await page.goto(await launchUrl(telegramId(info), { lang: 'en', theme: 'dark' }));
  await expect(page).toHaveURL(/\/en$/);

  const home = (await events(page, '/en')).map((e) => e.type);
  expect(home).toEqual(
    expect.arrayContaining([
      'web_app_ready',
      'web_app_expand',
      'web_app_request_theme',
      'web_app_set_background_color',
      'web_app_set_header_color',
    ]),
  );
  // Home has no back button.
  const backOnHome = (await events(page, '/en')).find(
    (e) => e.type === 'web_app_setup_back_button',
  );
  expect(backOnHome?.data).toEqual({ is_visible: false });

  // Telegram is dark, and no theme was chosen in Profile: Clavis follows it on every page.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const header = (await events(page, '/en')).find((e) => e.type === 'web_app_set_header_color');
  expect((header?.data as { color: string }).color).toMatch(/^#[0-9a-f]{6}$/i);

  await page.goto('/en/scholarships');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const back = (await events(page, '/en/scholarships')).find(
    (e) => e.type === 'web_app_setup_back_button',
  );
  expect(back?.data).toEqual({ is_visible: true });

  // Telegram switches to light while Clavis is open.
  await fromTelegram(page, 'theme_changed', { theme_params: THEMES.light });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Telegram's back button goes back to the previous page.
  await page.getByRole('link', { name: msg('en', 'footer.about') }).click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await fromTelegram(page, 'back_button_pressed');
  await expect(page).toHaveURL(/\/en\/scholarships$/);
});

test('back from the first page goes Home, not to /tg', async ({ page }, info) => {
  await fakeTelegram(page);
  // "Continue with Telegram" from a program page lands back on that page after sign-in.
  const next = encodeURIComponent('/en/scholarships');
  await page.goto(
    `${(await launchUrl(telegramId(info), { lang: 'en' })).replace('/tg#', `/tg?next=${next}#`)}`,
  );
  await expect(page).toHaveURL(/\/en\/scholarships$/);
  await fromTelegram(page, 'back_button_pressed');
  await expect(page).toHaveURL(/\/en$/);
});

test('inside Telegram, Continue with Telegram signs in again without the widget', async ({
  page,
}, info) => {
  await fakeTelegram(page);
  await page.goto(await launchUrl(telegramId(info), { lang: 'en' }));
  await expect(page).toHaveURL(/\/en$/);
  await page.goto('/en/my/profile');
  await page.getByRole('button', { name: msg('en', 'profile.signOut') }).click();

  await page.goto('/en/sign-in?next=%2Fen%2Fmy%2Fsaved');
  await page.getByRole('link', { name: msg('en', 'signIn.telegram') }).click();
  await expect(page).toHaveURL(/\/en\/my\/saved$/);
});

test('Share with parents uses Telegram’s share sheet', async ({ page }, info) => {
  await fakeTelegram(page);
  await page.goto(await launchUrl(telegramId(info), { lang: 'en' }));
  await expect(page).toHaveURL(/\/en$/);

  await page.goto('/en/programs/demo-u2-foundation-year');
  await page.getByRole('button', { name: new RegExp(`^${msg('en', 'track.path')}`) }).click();
  await expect(page).toHaveURL(/\/en\/my\/tracker\/\d+$/);
  await page.getByRole('link', { name: msg('en', 'share.cta') }).click();
  await page.getByLabel(msg('en', 'share.scope.tracker')).check();
  await page.getByRole('button', { name: msg('en', 'share.create') }).click();
  await expect(page.getByText(msg('en', 'share.created'))).toBeVisible();
  const url = await page.locator('.created').getByLabel(msg('en', 'share.linkLabel')).inputValue();

  await page
    .locator('.created')
    .getByRole('button', { name: msg('en', 'share.send') })
    .click();
  const sharePath = new URL(page.url()).pathname;
  await expect
    .poll(async () =>
      (await events(page, sharePath)).find((e) => e.type === 'web_app_open_tg_link'),
    )
    .toBeTruthy();
  const opened = (await events(page, sharePath)).find((e) => e.type === 'web_app_open_tg_link');
  const link = new URL(`https://t.me${(opened?.data as { path_full: string }).path_full}`);
  expect(link.pathname).toBe('/share/url');
  expect(link.searchParams.get('url')).toBe(url);
  expect(link.searchParams.get('text')).toBe(msg('en', 'share.message'));
});
