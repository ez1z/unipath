/**
 * The Mini App bridge's pure parts (launch hash, versions, light/dark) and the
 * bot that sends Telegram reminders. The bridge's events in a real page are
 * checked end to end in tests/e2e/m6.spec.ts.
 */
import { describe, expect, test } from 'vitest';
import { signInitData } from '../../src/lib/auth/telegram.ts';
import {
  parseLaunchHash,
  schemeOf,
  TG_SCHEME_KEY,
  versionAtLeast,
} from '../../src/lib/telegram-app.ts';
import { botSender, TelegramSendError } from '../../src/lib/telegram-bot.ts';
import { THEME_COOKIE, THEME_SCRIPT } from '../../src/lib/theme.ts';

const TOKEN = '123456:test-only-fake-token';

describe('launch hash', () => {
  test('reads initData, version, platform and theme as Telegram sends them', async () => {
    const initData = await signInitData(
      { user: JSON.stringify({ id: 42, language_code: 'ru' }), auth_date: '1800000000' },
      TOKEN,
    );
    const theme = { bg_color: '#ffffff', text_color: '#000000' };
    const hash =
      `#tgWebAppData=${encodeURIComponent(initData)}` +
      `&tgWebAppVersion=8.0&tgWebAppPlatform=ios` +
      `&tgWebAppThemeParams=${encodeURIComponent(JSON.stringify(theme))}`;
    expect(parseLaunchHash(hash)).toEqual({
      initData,
      version: '8.0',
      platform: 'ios',
      themeParams: theme,
    });
  });

  test('outside Telegram, or with a broken theme', () => {
    expect(parseLaunchHash('')).toBeNull();
    expect(parseLaunchHash('#main')).toBeNull();
    expect(parseLaunchHash('#tgWebAppData=a%3D1&tgWebAppThemeParams=%7B')).toEqual({
      initData: 'a=1',
      version: '6.0',
      platform: 'unknown',
      themeParams: null,
    });
  });
});

describe('versions', () => {
  test.each([
    ['6.1', '6.1', true],
    ['6.10', '6.9', true],
    ['7.0', '6.9', true],
    ['6.9', '7.10', false],
    ['7.10', '7.10', true],
    ['8', '7.10', true],
    ['x', '6.1', false],
  ])('%s at least %s: %s', (have, want, ok) => {
    expect(versionAtLeast(have, want)).toBe(ok);
  });
});

describe('light or dark from Telegram', () => {
  test('follows the background brightness', () => {
    expect(schemeOf({ bg_color: '#ffffff' })).toBe('light');
    expect(schemeOf({ bg_color: '#17212b' })).toBe('dark');
    expect(schemeOf({ bg_color: '#000' })).toBe('dark');
    expect(schemeOf({ bg_color: 'red' })).toBeNull();
    expect(schemeOf(null)).toBeNull();
  });

  test('the head script reads the same keys the bridge writes', () => {
    expect(THEME_SCRIPT).toContain(TG_SCHEME_KEY);
    expect(THEME_SCRIPT).toContain(THEME_COOKIE);
  });
});

describe('bot reminders', () => {
  test('sends one plain message to the Telegram user, without link previews', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const send = botSender(TOKEN, (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ ok: true });
    }) as typeof fetch);
    await send('42', '7 days left: Demo\n\nOpen: https://clavis.test/en/my/tracker/1');
    expect(calls).toEqual([
      {
        url: `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        body: {
          chat_id: '42',
          text: '7 days left: Demo\n\nOpen: https://clavis.test/en/my/tracker/1',
          link_preview_options: { is_disabled: true },
        },
      },
    ]);
  });

  test('a refusal throws, and the error never shows the token', async () => {
    const send = botSender(TOKEN, (async () =>
      Response.json(
        { ok: false, description: "Forbidden: bot can't initiate conversation with a user" },
        { status: 403 },
      )) as typeof fetch);
    const error = await send('42', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TelegramSendError);
    expect((error as TelegramSendError).status).toBe(403);
    expect(String(error)).toContain("can't initiate");
    expect(String(error)).not.toContain(TOKEN);
  });

  test('refuses anything but a numeric user id', async () => {
    const send = botSender(TOKEN, (() => Promise.reject(new Error('no call'))) as typeof fetch);
    await expect(send('@someone', 'x')).rejects.toBeInstanceOf(TelegramSendError);
  });
});
