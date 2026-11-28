/**
 * Sign-in with local stand-ins: a capturing mailer instead of email, a made-up
 * bot token to sign Telegram data, and fake Google keys (only the redirect to
 * Google is checked; the real round trip is in the manual steps for Eziz).
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { isAPIError } from 'better-auth/api';
import { createAuth, type Auth } from '../../src/lib/auth/auth.ts';
import { safeNextPath } from '../../src/lib/auth/next.ts';
import {
  isPlaceholderEmail,
  newTelegramState,
  placeholderEmail,
  TELEGRAM_STATE_COOKIE,
} from '../../src/lib/auth/telegram-plugin.ts';
import { signInitData, signLoginWidget } from '../../src/lib/auth/telegram.ts';
import {
  deleteAccount,
  ensureProfile,
  isSaved,
  parsePendingAction,
  setSaved,
} from '../../src/lib/account.ts';
import { emailAvailable, type Mail } from '../../src/lib/email.ts';
import { createTestDb, type TestDb } from './db/test-db.ts';

const SITE = 'http://localhost:4321';
const BOT_TOKEN = '123456:test-only-fake-token';

let t: TestDb;
let auth: Auth;
const outbox: Mail[] = [];
const usedTelegramData = new Set<string>();

/** Signed Telegram data plus the one-time state the Telegram page would have set. */
function withState(params: URLSearchParams, cookie?: string) {
  const state = newTelegramState();
  params.set('state', state);
  const cookies = [cookie, `${TELEGRAM_STATE_COOKIE}=${state}`].filter(Boolean).join('; ');
  return { query: params.toString(), cookie: cookies };
}

beforeAll(async () => {
  t = await createTestDb();
  auth = createAuth({
    db: t.db,
    siteUrl: SITE,
    secret: 'test-secret-test-secret-test-secret-0123',
    mailer: { send: (mail) => Promise.resolve(void outbox.push(mail)) },
    telegramBotToken: BOT_TOKEN,
    telegramMarkUsed: (key) => {
      if (usedTelegramData.has(key)) return Promise.resolve(false);
      usedTelegramData.add(key);
      return Promise.resolve(true);
    },
    google: { clientId: 'fake-google-client-id', clientSecret: 'fake-google-secret' },
  });
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${SITE}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: SITE,
        'X-Clavis-Lang': 'ru',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function get(path: string, cookie?: string) {
  return auth.handler(
    new Request(`${SITE}/api/auth${path}`, { headers: cookie ? { Cookie: cookie } : {} }),
  );
}

/** `name=value` pairs from Set-Cookie, ready for a Cookie header. */
function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function session(cookie: string) {
  const response = await get('/get-session', cookie);
  return (await response.json()) as { user: { id: string; email: string; role: string } } | null;
}

async function signInWithEmail(email: string): Promise<string> {
  outbox.length = 0;
  const sent = await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
  expect(sent.status).toBe(200);
  const code = outbox.at(-1)?.code;
  expect(code).toMatch(/^\d{6}$/);
  const signedIn = await post('/sign-in/email-otp', { email, otp: code });
  expect(signedIn.status).toBe(200);
  return cookieOf(signedIn);
}

async function countRows(table: string, column: string, value: string) {
  const row = await t.d1
    .prepare(`select count(*) n from ${table} where ${column} = ?`)
    .bind(value)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe('email code', () => {
  test('is offered only with a sender: production has none, local tests have the mailbox', () => {
    const production = { binding: false, from: '', devMailbox: false };
    expect(emailAvailable(production)).toBe(false);
    expect(emailAvailable({ ...production, from: 'no-reply@clavis.example' })).toBe(false);
    expect(emailAvailable({ ...production, binding: true })).toBe(false);
    expect(
      emailAvailable({ binding: true, from: 'no-reply@clavis.example', devMailbox: false }),
    ).toBe(true);
    expect(emailAvailable({ ...production, devMailbox: true })).toBe(true);
  });

  test('a 6-digit code by email, in the page language, signs in for 30 days', async () => {
    outbox.length = 0;
    await post('/email-otp/send-verification-otp', { email: 'aman@mail.test', type: 'sign-in' });
    const mail = outbox.at(-1);
    expect(mail?.to).toBe('aman@mail.test');
    expect(mail?.subject).toContain(mail?.code ?? 'missing');
    // X-Clavis-Lang: ru
    expect(mail?.text).toContain('Код действует 10 минут');

    const response = await post('/sign-in/email-otp', {
      email: 'aman@mail.test',
      otp: mail?.code,
    });
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith('clavis.session_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie ?? '')?.[1]);
    expect(maxAge).toBe(30 * 24 * 60 * 60);

    const me = await session(cookieOf(response));
    expect(me?.user.email).toBe('aman@mail.test');
    expect(me?.user.role).toBe('student');
    // Store the minimum: no IP address on the session.
    const row = await t.d1
      .prepare('select ip_address from session where user_id = ?')
      .bind(me?.user.id)
      .first<{ ip_address: string | null }>();
    expect(row?.ip_address || null).toBeNull();
  });

  test('a wrong code is refused, and the code is stored hashed', async () => {
    outbox.length = 0;
    await post('/email-otp/send-verification-otp', { email: 'jeren@mail.test', type: 'sign-in' });
    const code = outbox.at(-1)?.code ?? '';
    const wrong = code === '000000' ? '111111' : '000000';
    const response = await post('/sign-in/email-otp', { email: 'jeren@mail.test', otp: wrong });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const stored = await t.d1
      .prepare("select value from verification where identifier = 'sign-in-otp-jeren@mail.test'")
      .first<{ value: string }>();
    expect(stored?.value).toBeDefined();
    expect(stored?.value).not.toContain(code);
  });

  test('requests from another site are refused', async () => {
    const response = await auth.handler(
      new Request(`${SITE}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ email: 'x@mail.test', type: 'sign-in' }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe('Telegram Login Widget', () => {
  // A different auth_date per call: each piece of signed data is accepted only once.
  // Strictly decreasing, so two calls either side of a second boundary still differ.
  let last = Number.POSITIVE_INFINITY;
  const now = () => {
    last = Math.min(Math.floor(Date.now() / 1000), last - 1);
    return String(last);
  };
  const callback = async (
    fields: Record<string, string>,
    {
      next = '/en/my',
      cookie,
      token = BOT_TOKEN,
    }: { next?: string; cookie?: string; token?: string } = {},
  ) => {
    const params = await signLoginWidget(fields, token);
    params.set('next', next);
    params.set('fail', '/en/sign-in');
    const request = withState(params, cookie);
    return get(`/telegram/callback?${request.query}`, request.cookie);
  };
  const sessionCookies = (response: Response) =>
    response.headers.getSetCookie().filter((c) => c.startsWith('clavis.session_token='));

  test('valid data signs in a new user; only the Telegram id is kept', async () => {
    const response = await callback({
      id: '700100',
      first_name: 'Real',
      last_name: 'Name',
      username: 'real_name',
      auth_date: now(),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/en/my');
    const me = await session(cookieOf(response));
    expect(me?.user.email).toBe(placeholderEmail('700100'));
    expect(isPlaceholderEmail(me?.user.email ?? '')).toBe(true);
    const row = await t.d1
      .prepare('select name, image from user where id = ?')
      .bind(me?.user.id)
      .first<{ name: string; image: string | null }>();
    expect(row).toEqual({ name: '', image: null });
  });

  test('the same Telegram account signs in to the same user', async () => {
    const a = await session(cookieOf(await callback({ id: '700200', auth_date: now() })));
    const b = await session(cookieOf(await callback({ id: '700200', auth_date: now() })));
    expect(a?.user.id).toBeDefined();
    expect(b?.user.id).toBe(a?.user.id);
  });

  test('tampered, expired, wrongly signed or missing data is refused', async () => {
    const params = await signLoginWidget({ id: '700300', auth_date: now() }, BOT_TOKEN);
    params.set('id', '700301');
    params.set('fail', '/en/sign-in');
    const request = withState(params);
    const tampered = await get(`/telegram/callback?${request.query}`, request.cookie);
    expect(tampered.headers.get('Location')).toBe('/en/sign-in?error=telegram-failed');
    expect(sessionCookies(tampered)).toEqual([]);

    const old = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60);
    const expired = await callback({ id: '700302', auth_date: old });
    expect(expired.headers.get('Location')).toBe('/en/sign-in?error=telegram-expired');

    const otherBot = await callback({ id: '700303', auth_date: now() }, { token: '1:other' });
    expect(otherBot.headers.get('Location')).toBe('/en/sign-in?error=telegram-failed');

    const missing = await get('/telegram/callback?next=/en/my&fail=/en/sign-in');
    expect(missing.headers.get('Location')).toBe('/en/sign-in?error=telegram-failed');
  });

  test('older than an hour, or used before, is refused', async () => {
    const hourAgo = String(Math.floor(Date.now() / 1000) - 61 * 60);
    const late = await callback({ id: '700310', auth_date: hourAgo });
    expect(late.headers.get('Location')).toBe('/en/sign-in?error=telegram-expired');

    // The same signed data again (say, from browser history) doesn't sign in twice.
    const params = await signLoginWidget({ id: '700311', auth_date: now() }, BOT_TOKEN);
    params.set('fail', '/en/sign-in');
    const first = withState(new URLSearchParams(params));
    expect(
      sessionCookies(await get(`/telegram/callback?${first.query}`, first.cookie)),
    ).toHaveLength(1);
    const second = withState(new URLSearchParams(params));
    const replay = await get(`/telegram/callback?${second.query}`, second.cookie);
    expect(replay.headers.get('Location')).toBe('/en/sign-in?error=telegram-expired');
    expect(sessionCookies(replay)).toEqual([]);
  });

  test('a link built elsewhere (no matching state) neither links nor signs in', async () => {
    // Someone signs their own Telegram data and gets a signed-in student to open it.
    const victim = await signInWithEmail('victim@mail.test');
    const me = await session(victim);
    const params = await signLoginWidget({ id: '700320', auth_date: now() }, BOT_TOKEN);
    params.set('next', '/en/my');
    params.set('fail', '/en/sign-in');

    const noState = await get(`/telegram/callback?${params}`, victim);
    expect(noState.headers.get('Location')).toBe('/en/sign-in?error=telegram-failed');

    // The student has a state cookie from their own visit, but the link has another.
    params.set('state', newTelegramState());
    const wrong = await get(
      `/telegram/callback?${params}`,
      `${victim}; ${TELEGRAM_STATE_COOKIE}=${newTelegramState()}`,
    );
    expect(wrong.headers.get('Location')).toBe('/en/sign-in?error=telegram-failed');
    expect(await countRows('account', 'user_id', me?.user.id ?? '')).toBe(0);

    // Signed out, the same link doesn't sign the browser in to the other account.
    const signedOut = await get(`/telegram/callback?${params}`);
    expect(sessionCookies(signedOut)).toEqual([]);
    // The state is cleared after any try.
    expect(wrong.headers.getSetCookie().join()).toMatch(
      new RegExp(`${TELEGRAM_STATE_COOKIE}=;.*Max-Age=0`, 'i'),
    );
  });

  test('never redirects off the site', async () => {
    const response = await callback({ id: '700400', auth_date: now() }, { next: '//evil.example' });
    expect(response.headers.get('Location')).toBe('/');
  });

  test('signed in by email, Telegram links to the same user; taken elsewhere is refused', async () => {
    const cookie = await signInWithEmail('link@mail.test');
    const me = await session(cookie);
    const linked = await callback({ id: '700500', auth_date: now() }, { cookie });
    expect(linked.headers.get('Location')).toBe('/en/my');
    // Email-code users have no account row; Telegram adds one.
    expect(await countRows('account', 'user_id', me?.user.id ?? '')).toBe(1);

    // Signing in with that Telegram account later reaches the email user.
    const again = await session(cookieOf(await callback({ id: '700500', auth_date: now() })));
    expect(again?.user.id).toBe(me?.user.id);

    // 700100 belongs to someone else.
    const taken = await callback({ id: '700100', auth_date: now() }, { cookie });
    expect(taken.headers.get('Location')).toBe('/en/sign-in?error=telegram-taken');
  });

  test('a Telegram user can add an email and then sign in with it', async () => {
    const cookie = cookieOf(await callback({ id: '700600', auth_date: now() }));
    const me = await session(cookie);
    outbox.length = 0;
    const asked = await post(
      '/email-otp/request-email-change',
      { newEmail: 'added@mail.test' },
      cookie,
    );
    expect(asked.status).toBe(200);
    const code = outbox.at(-1)?.code;
    expect(outbox.at(-1)?.to).toBe('added@mail.test');
    const changed = await post(
      '/email-otp/change-email',
      { newEmail: 'added@mail.test', otp: code },
      cookie,
    );
    expect(changed.status).toBe(200);
    const byEmail = await session(await signInWithEmail('added@mail.test'));
    expect(byEmail?.user.id).toBe(me?.user.id);
  });
});

describe('Google (fake keys)', () => {
  test('"Continue with Google" goes to Google with Clavis\'s client id and callback', async () => {
    const response = await post('/sign-in/social', {
      provider: 'google',
      callbackURL: '/en/auth/continue',
    });
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    const google = new URL(url);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe('fake-google-client-id');
    expect(google.searchParams.get('redirect_uri')).toBe(`${SITE}/api/auth/callback/google`);
    expect(google.searchParams.get('state')).toBeTruthy();
  });
});

describe('next path', () => {
  test('only paths on this site', () => {
    expect(safeNextPath('/tk/programs/x?tab=costs')).toBe('/tk/programs/x?tab=costs');
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      'tk/my',
      '/x\r\nSet-Cookie: a=1',
      42,
      null,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });

  test('pending actions', () => {
    expect(parsePendingAction('save:program:101')).toEqual({
      kind: 'save',
      item: { type: 'program', id: 101 },
    });
    expect(parsePendingAction('save:user:1')).toBeNull();
    expect(parsePendingAction('delete:program:101')).toBeNull();
    expect(parsePendingAction('save:program:-4')).toBeNull();
  });
});

describe('saved items', () => {
  test('save, unsave; drafts and unknown records cannot be saved', async () => {
    const me = await session(await signInWithEmail('saver@mail.test'));
    const userId = me?.user.id ?? '';
    await ensureProfile(t.db, userId, 'en');
    expect(await setSaved(t.db, userId, { type: 'program', id: 101 }, true)).toBe('ok');
    // Saving twice is fine.
    expect(await setSaved(t.db, userId, { type: 'program', id: 101 }, true)).toBe('ok');
    expect(await isSaved(t.db, userId, { type: 'program', id: 101 })).toBe(true);
    expect(await setSaved(t.db, userId, { type: 'program', id: 105 }, true)).toBe('notFound');
    expect(await setSaved(t.db, userId, { type: 'scholarship', id: 999 }, true)).toBe('notFound');
    expect(await setSaved(t.db, userId, { type: 'program', id: 101 }, false)).toBe('ok');
    expect(await isSaved(t.db, userId, { type: 'program', id: 101 })).toBe(false);
  });
});

describe('deleting an account', () => {
  test("removes every row that belongs to the user, and nobody else's", async () => {
    const cookie = await signInWithEmail('leaving@mail.test');
    const me = await session(cookie);
    const userId = me?.user.id ?? '';
    await callback2(cookie);
    await ensureProfile(t.db, userId, 'tk');
    await setSaved(t.db, userId, { type: 'university', id: 1 }, true);
    // Rows in the tables later milestones fill, written directly.
    await t.d1.batch([
      t.d1
        .prepare('insert into tracker_items (id, user_id, program_id) values (9001, ?, 101)')
        .bind(userId),
      t.d1.prepare("insert into tracker_tasks (item_id, title) values (9001, 'IELTS')"),
      t.d1
        .prepare(
          "insert into share_links (token, user_id, scope, expires_at) values ('tok-leaving', ?, 'tracker', 0)",
        )
        .bind(userId),
      t.d1.prepare(
        'insert into reminder_log (tracker_item_id, days_before, sent_at) values (9001, 30, 0)',
      ),
    ]);
    // A pending code for the same address.
    await post('/email-otp/send-verification-otp', { email: 'leaving@mail.test', type: 'sign-in' });

    const other = await session(await signInWithEmail('staying@mail.test'));
    await ensureProfile(t.db, other?.user.id ?? '', 'en');

    await deleteAccount(t.db, userId);

    for (const [table, column] of [
      ['user', 'id'],
      ['session', 'user_id'],
      ['account', 'user_id'],
      ['profiles', 'user_id'],
      ['saved_items', 'user_id'],
      ['tracker_items', 'user_id'],
      ['share_links', 'user_id'],
    ] as const) {
      expect(await countRows(table, column, userId), table).toBe(0);
    }
    expect(await countRows('tracker_tasks', 'item_id', '9001')).toBe(0);
    expect(await countRows('reminder_log', 'tracker_item_id', '9001')).toBe(0);
    expect(await countRows('verification', 'identifier', 'sign-in-otp-leaving@mail.test')).toBe(0);
    // The old cookie no longer works.
    expect(await session(cookie)).toBeNull();
    // Someone else's account is untouched.
    expect(await countRows('profiles', 'user_id', other?.user.id ?? '')).toBe(1);
  });
});

/** Links a Telegram account to the signed-in user, so `account` has a row too. */
async function callback2(cookie: string) {
  const params = await signLoginWidget(
    { id: '700900', auth_date: String(Math.floor(Date.now() / 1000)) },
    BOT_TOKEN,
  );
  params.set('next', '/en/my');
  const request = withState(params, cookie);
  await get(`/telegram/callback?${request.query}`, request.cookie);
}

describe('Telegram Mini App (initData)', () => {
  const now = () => String(Math.floor(Date.now() / 1000));
  const initData = (id: number, fields: Record<string, string> = {}, token = BOT_TOKEN) =>
    signInitData(
      {
        user: JSON.stringify({ id, first_name: 'Real', language_code: 'ru' }),
        auth_date: now(),
        query_id: 'AAE',
        ...fields,
      },
      token,
    );
  /** The server-side call /tg makes, answered as an HTTP-like Response. */
  const webapp = async (data: string, cookie?: string) => {
    try {
      return await auth.api.telegramWebApp({
        body: { initData: data },
        headers: new Headers(cookie ? { Cookie: cookie } : {}),
        asResponse: true,
      });
    } catch (error) {
      if (isAPIError(error)) return new Response(null, { status: error.statusCode });
      throw error;
    }
  };
  const sessionCookies = (response: Response) =>
    response.headers.getSetCookie().filter((c) => c.startsWith('clavis.session_token='));

  test('valid initData signs in silently; a new user keeps only the Telegram id', async () => {
    const response = await webapp(await initData(800100));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; created: boolean; languageCode: string };
    expect(body).toMatchObject({ ok: true, created: true, languageCode: 'ru' });
    const me = await session(cookieOf(response));
    expect(me?.user.email).toBe(placeholderEmail('800100'));
    const row = await t.d1
      .prepare('select name, image from user where id = ?')
      .bind(me?.user.id)
      .first<{ name: string; image: string | null }>();
    expect(row).toEqual({ name: '', image: null });
  });

  test('the Mini App and the Login Widget reach the same user', async () => {
    const widget = withState(await signLoginWidget({ id: '800200', auth_date: now() }, BOT_TOKEN));
    const fromWidget = await session(
      cookieOf(await get(`/telegram/callback?${widget.query}`, widget.cookie)),
    );
    expect(fromWidget?.user.id).toBeDefined();

    const fromApp = await webapp(await initData(800200));
    expect(((await fromApp.json()) as { created: boolean }).created).toBe(false);
    expect((await session(cookieOf(fromApp)))?.user.id).toBe(fromWidget?.user.id);
  });

  test('already signed in as that Telegram user: no new session', async () => {
    const cookie = cookieOf(await webapp(await initData(800300)));
    const again = await webapp(await initData(800300), cookie);
    expect(again.status).toBe(200);
    expect(sessionCookies(again)).toEqual([]);
    expect(await countRows('session', 'user_id', (await session(cookie))?.user.id ?? '')).toBe(1);
  });

  test('signed in as someone else: the Telegram user replaces that session, nothing is linked', async () => {
    const emailCookie = await signInWithEmail('mini-app@mail.test');
    const emailUser = await session(emailCookie);
    const response = await webapp(await initData(800400), emailCookie);
    const me = await session(cookieOf(response));
    expect(me?.user.email).toBe(placeholderEmail('800400'));
    expect(me?.user.id).not.toBe(emailUser?.user.id);
    expect(await countRows('account', 'user_id', emailUser?.user.id ?? '')).toBe(0);
    expect(await session(emailCookie)).toBeNull();
  });

  test('tampered, expired, other bot or missing initData is refused without a session', async () => {
    const good = new URLSearchParams(await initData(800500));
    good.set('user', JSON.stringify({ id: 800501, language_code: 'ru' }));
    const tampered = await webapp(good.toString());
    expect(tampered.status).toBe(401);
    expect(await tampered.json()).toEqual({ ok: false, error: 'failed' });
    expect(sessionCookies(tampered)).toEqual([]);

    const old = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60);
    const expired = await webapp(await initData(800502, { auth_date: old }));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ ok: false, error: 'expired' });

    const otherBot = await webapp(await initData(800503, {}, '1:other'));
    expect(otherBot.status).toBe(401);

    const empty = await webapp('');
    expect(empty.status).toBe(400);
    expect(await countRows('user', 'email', placeholderEmail('800501'))).toBe(0);
  });

  test('there is no HTTP endpoint for it: only /tg (origin-checked, limited) can call it', async () => {
    const direct = await post('/telegram/webapp', { initData: await initData(800600) });
    expect(direct.status).toBe(404);
    expect(sessionCookies(direct)).toEqual([]);
  });
});
