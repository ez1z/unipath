import { beforeEach, describe, expect, test } from 'vitest';
import {
  BROWSER_CACHE_CONTROL,
  bumpDataVersion,
  CACHE_STATUS_HEADER,
  cacheKey,
  cachePolicy,
  getDataVersion,
  resetDataVersionMemo,
  TTL,
  withPageCache,
  type CacheContext,
} from '../../src/lib/cache.ts';

const ORIGIN = 'https://clavis.example';
const policy = (path: string) => cachePolicy(new URL(path, ORIGIN));

describe('cachePolicy', () => {
  test('Home, search and scholarships are cached briefly; detail pages longer', () => {
    expect(policy('/tk')).toEqual({ ttl: TTL.home, query: '' });
    expect(policy('/en/search')?.ttl).toBe(TTL.search);
    expect(policy('/ru/scholarships')?.ttl).toBe(TTL.search);
    for (const path of [
      '/en/programs/demo-u1-medicine',
      '/en/universities/demo-university-1',
      '/en/colleges/demo-pathway-college-1',
      '/en/scholarships/demo-scholarship-1',
    ]) {
      expect(policy(path)?.ttl, path).toBe(TTL.detail);
    }
  });

  test('account, share, admin, compare and report pages are never cached', () => {
    for (const path of [
      '/en/compare?ids=101',
      '/en/report?type=program&id=101',
      '/en/my',
      '/en/my/saved',
      '/en/my/profile',
      '/en/sign-in',
      '/en/sign-in/telegram',
      '/en/auth/continue?next=/en',
      '/en/account-deleted',
      '/en/share/abc',
      '/admin',
      '/api/report',
      '/api/save?type=program&id=101',
      '/api/me',
      '/api/auth/get-session',
      '/api/dev/mailbox?to=a@b.c',
      '/xx/search',
      '/',
    ]) {
      expect(policy(path), path).toBeNull();
    }
  });

  test('the query is canonical: stray params dropped, filters in a fixed order', () => {
    const a = policy('/en/search?utm_source=tg&country=TR&level=bachelor&country=GB');
    const b = policy('/en/search?level=bachelor&country=GB&country=TR&fbclid=1');
    expect(a?.query).toBe(b?.query);
    expect(a?.query).not.toContain('utm');
    expect(policy('/en/programs/x?ref=1')?.query).toBe('');
    expect(policy('/tk?anything=1')?.query).toBe('');
  });

  test('Matches for you is cached per canonical set of answers', () => {
    const a = policy('/en/matches?country=TR&field=law&ielts=6&utm_source=x');
    const b = policy('/en/matches?ielts=6&field=law&country=TR');
    expect(a?.ttl).toBe(TTL.search);
    expect(a?.query).toBe(b?.query);
    expect(a?.query).not.toContain('utm');
  });

  test('only university pages keep their tab', () => {
    expect(policy('/en/universities/u?tab=costs')?.query).toBe('tab=costs');
    expect(policy('/en/universities/u?tab=programs')?.query).toBe('');
    expect(policy('/en/universities/u?tab=nonsense')?.query).toBe('');
    expect(policy('/en/programs/p?tab=costs')?.query).toBe('');
  });

  test('the count endpoint is cached per kind and canonical filters', () => {
    const a = policy('/api/search/count?kind=programs&lang=en&level=bachelor&x=1');
    expect(a).not.toBeNull();
    expect(policy('/api/search/count?kind=nope&lang=en')).toBeNull();
  });
});

describe('cacheKey', () => {
  const url = new URL('/en/search?level=bachelor', ORIGIN);
  const p = { ttl: 60, query: 'level=bachelor' };

  test('changes with the data version and with the build', () => {
    const base = cacheKey(url, p, 3, 'b1');
    expect(base).toBe(`${ORIGIN}/__cache/b1/v3/en/search?level=bachelor`);
    expect(cacheKey(url, p, 4, 'b1')).not.toBe(base);
    expect(cacheKey(url, p, 3, 'b2')).not.toBe(base);
  });
});

/** In-memory stand-ins for KV and the Workers Cache API. */
function fakeContext() {
  const store = new Map<string, Response>();
  const kv = new Map<string, string>();
  const pending: Promise<unknown>[] = [];
  const ctx: CacheContext = {
    cache: {
      match: (key: RequestInfo | URL) => {
        const hit = store.get(String(key));
        return Promise.resolve(hit ? hit.clone() : undefined);
      },
      put: async (key: RequestInfo | URL, response: Response) => {
        store.set(String(key), new Response(await response.arrayBuffer(), response));
      },
      delete: () => Promise.resolve(false),
    } as unknown as Cache,
    kv: {
      get: (key: string) => Promise.resolve(kv.get(key) ?? null),
      put: (key: string, value: string) => {
        kv.set(key, value);
        return Promise.resolve();
      },
    } as unknown as KVNamespace,
    waitUntil: (promise) => pending.push(promise),
  };
  return { ctx, store, settle: () => Promise.all(pending) };
}

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...init.headers },
  });

describe('withPageCache', () => {
  beforeEach(() => resetDataVersionMemo());

  test('miss, then hit; browsers are told to revalidate', async () => {
    const { ctx, settle } = fakeContext();
    let renders = 0;
    const render = () => Promise.resolve(html(`page ${++renders}`));
    const request = () => new Request(`${ORIGIN}/en/search?level=bachelor`);

    const first = await withPageCache(request(), render, ctx);
    await settle();
    expect(first.headers.get(CACHE_STATUS_HEADER)).toBe('miss');
    expect(first.headers.get('Cache-Control')).toBe(BROWSER_CACHE_CONTROL);

    const second = await withPageCache(request(), render, ctx);
    expect(second.headers.get(CACHE_STATUS_HEADER)).toBe('hit');
    expect(second.headers.get('Cache-Control')).toBe(BROWSER_CACHE_CONTROL);
    expect(await second.text()).toBe('page 1');
    expect(renders).toBe(1);
  });

  test('a new data version renders again', async () => {
    const { ctx, settle } = fakeContext();
    let renders = 0;
    const render = () => Promise.resolve(html(`page ${++renders}`));
    await withPageCache(new Request(`${ORIGIN}/tk`), render, ctx);
    await settle();
    await bumpDataVersion(ctx.kv);
    const after = await withPageCache(new Request(`${ORIGIN}/tk`), render, ctx);
    expect(after.headers.get(CACHE_STATUS_HEADER)).toBe('miss');
    expect(renders).toBe(2);
  });

  test('never stores errors, cookies or non-GET requests', async () => {
    const { ctx, store, settle } = fakeContext();
    const url = `${ORIGIN}/en/programs/demo-u1-medicine`;
    await withPageCache(
      new Request(url),
      () => Promise.resolve(html('gone', { status: 404 })),
      ctx,
    );
    await withPageCache(
      new Request(url),
      () => Promise.resolve(html('hi', { headers: { 'Set-Cookie': 'a=1' } })),
      ctx,
    );
    const post = await withPageCache(
      new Request(url, { method: 'POST' }),
      () => Promise.resolve(html('posted')),
      ctx,
    );
    await settle();
    expect(store.size).toBe(0);
    expect(post.headers.get(CACHE_STATUS_HEADER)).toBeNull();
  });

  test('without a cache (dev) cached routes are marked bypass', async () => {
    const response = await withPageCache(
      new Request(`${ORIGIN}/en/search`),
      () => Promise.resolve(html('x')),
      null,
    );
    expect(response.headers.get(CACHE_STATUS_HEADER)).toBe('bypass');
  });
});

describe('data version', () => {
  beforeEach(() => resetDataVersionMemo());

  test('is 0 until bumped, then memoised for a few seconds', async () => {
    const { ctx } = fakeContext();
    expect(await getDataVersion(ctx.kv, 1000)).toBe(0);
    await ctx.kv.put('data_version', '7');
    // Still memoised…
    expect(await getDataVersion(ctx.kv, 2000)).toBe(0);
    // …and re-read after the memo expires.
    expect(await getDataVersion(ctx.kv, 1000 + 6000)).toBe(7);
    expect(await bumpDataVersion(ctx.kv)).toBe(8);
  });

  test('a garbage value counts as 0', async () => {
    const { ctx } = fakeContext();
    await ctx.kv.put('data_version', 'abc');
    expect(await getDataVersion(ctx.kv, 0)).toBe(0);
  });
});
