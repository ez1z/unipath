/**
 * /sitemap.xml: every public page in the three languages, each entry listing
 * its other-language versions (hreflang), like the <link rel="alternate">
 * tags in BaseLayout. Only published records; account, sign-in, share,
 * forms and admin pages stay out (they are noindex too).
 */
import { DEFAULT_LANG, LANGS } from '../i18n/config.ts';
import { TOPIC_SLUGS } from './db/values.ts';

export interface SitemapEntry {
  /** Path without the language, e.g. `/universities/demo-university-1`; '' is home. */
  path: string;
  /** YYYY-MM-DD: the day the facts were last checked. */
  lastmod?: string | undefined;
}

/** Pages that aren't records. */
export const STATIC_PATHS = [
  '',
  '/search',
  '/scholarships',
  '/discussions',
  '/about',
  '/how-we-check',
  '/privacy',
  ...TOPIC_SLUGS.map((slug) => `/discussions/${slug}`),
];

/**
 * Published records, the same ones their pages show. Each query walks an index
 * that starts with `published` (`*_published_*_idx`); a program also needs its
 * university or college published (queries.ts programVisible).
 */
const RECORDS = [
  ['universities', 'SELECT slug, last_checked FROM universities WHERE published = 1'],
  [
    'programs',
    `SELECT p.slug, p.last_checked FROM programs p
     LEFT JOIN universities u ON u.id = p.university_id
     LEFT JOIN pathway_colleges c ON c.id = p.college_id
     WHERE p.published = 1 AND coalesce(u.published, c.published) = 1`,
  ],
  ['colleges', 'SELECT slug, last_checked FROM pathway_colleges WHERE published = 1'],
  ['scholarships', 'SELECT slug, last_checked FROM scholarships WHERE published = 1'],
] as const;

export async function loadSitemapEntries(d1: D1Database): Promise<SitemapEntry[]> {
  const results = await d1.batch<{ slug: string; last_checked: string }>(
    RECORDS.map(([, query]) => d1.prepare(`${query} ORDER BY 1`)),
  );
  const records = RECORDS.flatMap(([section], i) =>
    (results[i]?.results ?? []).map((r) => ({
      path: `/${section}/${r.slug}`,
      lastmod: r.last_checked,
    })),
  );
  return [...STATIC_PATHS.map((path) => ({ path })), ...records];
}

const xml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(site: string, entries: SitemapEntry[]): string {
  const base = site.replace(/\/$/, '');
  const href = (lang: string, path: string) => xml(`${base}/${lang}${path}`);
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const { path, lastmod } of entries) {
    const alternates = [
      ...LANGS.map(
        (code) => `<xhtml:link rel="alternate" hreflang="${code}" href="${href(code, path)}"/>`,
      ),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${href(DEFAULT_LANG, path)}"/>`,
    ].join('');
    const modified =
      lastmod && /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : '';
    for (const lang of LANGS) {
      out.push(`<url><loc>${href(lang, path)}</loc>${modified}${alternates}</url>`);
    }
  }
  out.push('</urlset>');
  return `${out.join('\n')}\n`;
}

export function robotsTxt(site: string): string {
  const base = site.replace(/\/$/, '');
  return [
    'User-agent: *',
    // Private and per-visitor pages; they are also noindex.
    'Disallow: /admin',
    'Disallow: /api/',
    ...LANGS.flatMap((lang) => [
      `Disallow: /${lang}/my`,
      `Disallow: /${lang}/share/`,
      `Disallow: /${lang}/sign-in`,
    ]),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}
