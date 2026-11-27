/**
 * Page cache (SPEC.md "Caching"). Public server pages are kept in the Workers
 * Cache API under a key made of route, language, canonical query string and the
 * `data_version` number in KV. Every admin save bumps `data_version` (M7), so
 * all cached pages refresh on their next view with no purging. Account, share,
 * admin, Compare and form pages are never cached.
 */
import { isLang, splitLangPath } from '../i18n/config.ts';
import {
  parseProgramFilters,
  parseScholarshipFilters,
  parseUniversityFilters,
  serializeProgramFilters,
  serializeScholarshipFilters,
  serializeUniversityFilters,
} from './search/filters.ts';

export const DATA_VERSION_KEY = 'data_version';

/** How long a cached copy may be served, in seconds, per page kind. */
export const TTL = {
  home: 300,
  search: 60,
  detail: 600,
} as const;

export interface CachePolicy {
  ttl: number;
  /** The query string the page actually reads, in a fixed order; part of the key. */
  query: string;
}

export type SearchTab = 'programs' | 'universities';

export function searchTab(params: URLSearchParams): SearchTab {
  return params.get('tab') === 'universities' ? 'universities' : 'programs';
}

/** The canonical query of the search page: the tab plus that tab's filters. */
export function canonicalSearchQuery(params: URLSearchParams): string {
  const tab = searchTab(params);
  const filters =
    tab === 'universities'
      ? serializeUniversityFilters(parseUniversityFilters(params))
      : serializeProgramFilters(parseProgramFilters(params));
  const out = new URLSearchParams();
  if (tab === 'universities') out.set('tab', tab);
  for (const [key, value] of filters) out.append(key, value);
  return out.toString();
}

export const UNIVERSITY_TABS = [
  'programs',
  'overview',
  'costs',
  'requirements',
  'scholarships',
] as const;
export type UniversityTab = (typeof UNIVERSITY_TABS)[number];

export function universityTab(params: URLSearchParams): UniversityTab {
  const tab = params.get('tab');
  return (UNIVERSITY_TABS as readonly string[]).includes(tab ?? '')
    ? (tab as UniversityTab)
    : 'programs';
}

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const DETAIL = new RegExp(`^/(universities|programs|colleges|scholarships)/${SLUG}$`);

/**
 * Whether and how a GET request may be served from the cache. Null means never
 * cache: unknown routes, account, share, admin, Compare and Report pages.
 */
export function cachePolicy(url: URL): CachePolicy | null {
  if (url.pathname === COUNT_PATH) return countPolicy(url.searchParams);
  const { lang, rest } = splitLangPath(url.pathname);
  if (lang === null) return null;
  const params = url.searchParams;

  if (rest === '') return { ttl: TTL.home, query: '' };
  if (rest === '/search') return { ttl: TTL.search, query: canonicalSearchQuery(params) };
  if (rest === '/scholarships') {
    return {
      ttl: TTL.search,
      query: serializeScholarshipFilters(parseScholarshipFilters(params)).toString(),
    };
  }
  const detail = DETAIL.exec(rest);
  if (detail) {
    const tab = detail[1] === 'universities' ? universityTab(params) : 'programs';
    return { ttl: TTL.detail, query: tab === 'programs' ? '' : `tab=${tab}` };
  }
  return null;
}

/** Live result count for the filter sheet (pages/api/search/count.ts). */
export const COUNT_PATH = '/api/search/count';
export const COUNT_KINDS = ['programs', 'universities', 'scholarships'] as const;
export type CountKind = (typeof COUNT_KINDS)[number];

export function countKind(params: URLSearchParams): CountKind | null {
  const kind = params.get('kind');
  return (COUNT_KINDS as readonly string[]).includes(kind ?? '') ? (kind as CountKind) : null;
}

function countPolicy(params: URLSearchParams): CachePolicy | null {
  const kind = countKind(params);
  const lang = params.get('lang');
  if (!kind || !isLang(lang)) return null;
  const filters =
    kind === 'scholarships'
      ? serializeScholarshipFilters({ ...parseScholarshipFilters(params), page: 1 })
      : kind === 'universities'
        ? serializeUniversityFilters({ ...parseUniversityFilters(params), page: 1 })
        : serializeProgramFilters({ ...parseProgramFilters(params), sort: 'relevance', page: 1 });
  const query = new URLSearchParams({ kind, lang });
  for (const [k, v] of filters) query.append(k, v);
  return { ttl: TTL.search, query: query.toString() };
}

/** The Cache API key: the site's own origin, so it stays inside this zone. */
/** This build's id (astro.config.mjs); 'dev' outside a build. */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/**
 * Cache key: the data version (bumped on publish) and the build (changes on deploy),
 * then the path and canonical query.
 */
export function cacheKey(
  url: URL,
  policy: CachePolicy,
  dataVersion: number,
  build: string = BUILD_ID,
): string {
  const query = policy.query ? `?${policy.query}` : '';
  return `${url.origin}/__cache/${build}/v${dataVersion}${url.pathname}${query}`;
}

// ---------------------------------------------------------------------------
// data_version
// ---------------------------------------------------------------------------

/** Each isolate re-reads data_version at most this often, so admin edits show within seconds. */
const VERSION_MEMO_MS = 5_000;
let memo: { value: number; at: number } | null = null;

export async function getDataVersion(kv: KVNamespace, now = Date.now()): Promise<number> {
  if (memo && now - memo.at < VERSION_MEMO_MS) return memo.value;
  const raw = await kv.get(DATA_VERSION_KEY);
  const value = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
  memo = { value, at: now };
  return value;
}

/** Called after every admin save (M7) and by the seed: all cached pages go stale. */
export async function bumpDataVersion(kv: KVNamespace): Promise<number> {
  const next = (await getDataVersion(kv, Number.POSITIVE_INFINITY)) + 1;
  await kv.put(DATA_VERSION_KEY, String(next));
  memo = null;
  return next;
}

/** For tests. */
export function resetDataVersionMemo(): void {
  memo = null;
}

// ---------------------------------------------------------------------------
// Serving through the cache
// ---------------------------------------------------------------------------

/** What browsers get: always ask again, so a new data_version shows on the next load. */
export const BROWSER_CACHE_CONTROL = 'no-cache';
export const CACHE_STATUS_HEADER = 'X-Clavis-Cache';

export interface CacheContext {
  cache: Cache;
  kv: KVNamespace;
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * Serves `request` from the cache when it can, else renders it and stores a
 * copy. Only plain 200 HTML responses without cookies are stored.
 */
export async function withPageCache(
  request: Request,
  render: () => Promise<Response>,
  ctx: CacheContext | null,
): Promise<Response> {
  const url = new URL(request.url);
  const policy = request.method === 'GET' ? cachePolicy(url) : null;
  if (!policy || !ctx) {
    const response = await render();
    return policy ? markBypass(response) : response;
  }

  const key = cacheKey(url, policy, await getDataVersion(ctx.kv));
  const hit = await ctx.cache.match(key);
  if (hit) return forBrowser(hit, 'hit');

  const response = await render();
  if (!isStorable(response)) return markBypass(response);

  const stored = new Response(response.clone().body, response);
  stored.headers.set('Cache-Control', `public, max-age=${policy.ttl}`);
  stored.headers.delete(CACHE_STATUS_HEADER);
  ctx.waitUntil(ctx.cache.put(key, stored));
  return forBrowser(response, 'miss');
}

function isStorable(response: Response): boolean {
  const type = response.headers.get('Content-Type') ?? '';
  return (
    response.status === 200 &&
    !response.headers.has('Set-Cookie') &&
    (type.startsWith('text/html') || type.startsWith('application/json'))
  );
}

function forBrowser(response: Response, status: 'hit' | 'miss'): Response {
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', BROWSER_CACHE_CONTROL);
  out.headers.set(CACHE_STATUS_HEADER, status);
  return out;
}

function markBypass(response: Response): Response {
  const out = new Response(response.body, response);
  out.headers.set(CACHE_STATUS_HEADER, 'bypass');
  if (!out.headers.has('Cache-Control')) out.headers.set('Cache-Control', BROWSER_CACHE_CONTROL);
  return out;
}
