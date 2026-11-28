import { describe, expect, test } from 'vitest';
import {
  dataCheckString,
  langFromTelegram,
  signInitData,
  signLoginWidget,
  TELEGRAM_MAX_AGE_SECONDS,
  verifyInitData,
  verifyLoginWidget,
} from '../../src/lib/auth/telegram.ts';

const TOKEN = '123456:test-only-fake-token';
const NOW = 1_800_000_000;

describe('data-check-string', () => {
  test('every field but hash, sorted, one per line', () => {
    expect(
      dataCheckString([
        ['username', 'a'],
        ['hash', 'x'],
        ['auth_date', '1'],
        ['id', '7'],
      ]),
    ).toBe('auth_date=1\nid=7\nusername=a');
  });
});

describe('Login Widget', () => {
  const signed = (fields: Record<string, string>) => signLoginWidget(fields, TOKEN);

  test('valid', async () => {
    const params = await signed({ id: '42', first_name: 'A', auth_date: String(NOW - 60) });
    expect(await verifyLoginWidget(params, TOKEN, NOW)).toEqual({
      ok: true,
      telegramId: '42',
      authDate: NOW - 60,
    });
  });

  test('tampered: any changed or added field breaks the hash', async () => {
    const params = await signed({ id: '42', auth_date: String(NOW) });
    const changed = new URLSearchParams(params);
    changed.set('id', '43');
    expect(await verifyLoginWidget(changed, TOKEN, NOW)).toEqual({ ok: false, reason: 'bad-hash' });
    const added = new URLSearchParams(params);
    added.set('username', 'someone');
    expect(await verifyLoginWidget(added, TOKEN, NOW)).toEqual({ ok: false, reason: 'bad-hash' });
  });

  test('signed with another bot token', async () => {
    const params = await signLoginWidget({ id: '42', auth_date: String(NOW) }, '9:other');
    expect((await verifyLoginWidget(params, TOKEN, NOW)).ok).toBe(false);
  });

  test('older than 24 hours, or far in the future', async () => {
    const old = await signed({ id: '42', auth_date: String(NOW - TELEGRAM_MAX_AGE_SECONDS - 1) });
    expect(await verifyLoginWidget(old, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
    const edge = await signed({ id: '42', auth_date: String(NOW - TELEGRAM_MAX_AGE_SECONDS) });
    expect((await verifyLoginWidget(edge, TOKEN, NOW)).ok).toBe(true);
    const future = await signed({ id: '42', auth_date: String(NOW + 3600) });
    expect(await verifyLoginWidget(future, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  test('missing fields, a bad id, or no bot token configured', async () => {
    expect(await verifyLoginWidget(new URLSearchParams(), TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'missing',
    });
    const badId = await signed({ id: '42; drop', auth_date: String(NOW) });
    expect((await verifyLoginWidget(badId, TOKEN, NOW)).ok).toBe(false);
    const params = await signed({ id: '42', auth_date: String(NOW) });
    expect(await verifyLoginWidget(params, undefined, NOW)).toEqual({
      ok: false,
      reason: 'no-token',
    });
  });

  test('a widget hash does not pass as Mini App data (different keys)', async () => {
    const params = await signed({ id: '42', auth_date: String(NOW) });
    params.set('user', JSON.stringify({ id: 42 }));
    expect((await verifyInitData(params.toString(), TOKEN, NOW)).ok).toBe(false);
  });
});

describe('Mini App initData', () => {
  const user = JSON.stringify({ id: 42, first_name: 'A', language_code: 'ru' });

  test('valid, with the Telegram language', async () => {
    const data = await signInitData({ user, auth_date: String(NOW), query_id: 'q' }, TOKEN);
    expect(await verifyInitData(data, TOKEN, NOW)).toEqual({
      ok: true,
      telegramId: '42',
      authDate: NOW,
      languageCode: 'ru',
    });
  });

  test('tampered user', async () => {
    const data = new URLSearchParams(await signInitData({ user, auth_date: String(NOW) }, TOKEN));
    data.set('user', JSON.stringify({ id: 43, first_name: 'A' }));
    expect(await verifyInitData(data.toString(), TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'bad-hash',
    });
  });

  test('expired', async () => {
    const data = await signInitData({ user, auth_date: String(NOW - 2 * 86_400) }, TOKEN);
    expect(await verifyInitData(data, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  test('no user or broken JSON', async () => {
    const noUser = await signInitData({ auth_date: String(NOW) }, TOKEN);
    expect((await verifyInitData(noUser, TOKEN, NOW)).ok).toBe(false);
    const broken = await signInitData({ user: '{', auth_date: String(NOW) }, TOKEN);
    expect((await verifyInitData(broken, TOKEN, NOW)).ok).toBe(false);
  });
});

describe('Mini App initData, more cases', () => {
  const user = JSON.stringify({ id: 42, first_name: 'A', language_code: 'en' });

  test('just inside and just outside 24 hours', async () => {
    const edge = await signInitData(
      { user, auth_date: String(NOW - TELEGRAM_MAX_AGE_SECONDS) },
      TOKEN,
    );
    expect((await verifyInitData(edge, TOKEN, NOW)).ok).toBe(true);
    const late = await signInitData(
      { user, auth_date: String(NOW - TELEGRAM_MAX_AGE_SECONDS - 1) },
      TOKEN,
    );
    expect(await verifyInitData(late, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  test('a date far in the future is refused', async () => {
    const future = await signInitData({ user, auth_date: String(NOW + 3600) }, TOKEN);
    expect(await verifyInitData(future, TOKEN, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  test('tampered auth_date, removed field, or added field', async () => {
    const data = await signInitData({ user, auth_date: String(NOW - 100), query_id: 'q' }, TOKEN);
    const newer = new URLSearchParams(data);
    newer.set('auth_date', String(NOW));
    expect((await verifyInitData(newer.toString(), TOKEN, NOW)).ok).toBe(false);
    const fewer = new URLSearchParams(data);
    fewer.delete('query_id');
    expect((await verifyInitData(fewer.toString(), TOKEN, NOW)).ok).toBe(false);
    const more = new URLSearchParams(data);
    more.set('start_param', 'x');
    expect((await verifyInitData(more.toString(), TOKEN, NOW)).ok).toBe(false);
  });

  test('another bot, no hash, no token', async () => {
    const data = await signInitData({ user, auth_date: String(NOW) }, '999:other-bot');
    expect(await verifyInitData(data, TOKEN, NOW)).toEqual({ ok: false, reason: 'bad-hash' });
    const noHash = new URLSearchParams(data);
    noHash.delete('hash');
    expect(await verifyInitData(noHash.toString(), TOKEN, NOW)).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(await verifyInitData(data, undefined, NOW)).toEqual({ ok: false, reason: 'no-token' });
  });

  test('Login Widget data is not accepted as initData (different keys)', async () => {
    const widget = await signLoginWidget({ id: '42', auth_date: String(NOW) }, TOKEN);
    widget.set('user', JSON.stringify({ id: 42 }));
    expect((await verifyInitData(widget.toString(), TOKEN, NOW)).ok).toBe(false);
  });

  test('a user id that is not a number is refused', async () => {
    const data = await signInitData(
      { user: JSON.stringify({ id: '42' }), auth_date: String(NOW) },
      TOKEN,
    );
    expect((await verifyInitData(data, TOKEN, NOW)).ok).toBe(false);
  });
});

describe('language from Telegram', () => {
  test.each([
    ['ru', 'ru'],
    ['en-US', 'en'],
    ['tk', 'tk'],
    ['RU', 'ru'],
    ['uk', null],
    ['tr', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (code, lang) => {
    expect(langFromTelegram(code)).toBe(lang);
  });
});
