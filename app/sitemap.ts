import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { getSiteUrl, localeAlternates } from '@/lib/seo';
import { getAll as getAllUniversities } from '@/lib/data/universities';
import { getAll as getAllScholarships } from '@/lib/data/scholarships';

const STATIC_PATHS = ['', '/universities', '/scholarships', '/compare', '/transfer', '/support', '/moe-approved'];

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const [universities, scholarships] = await Promise.all([
    getAllUniversities().catch(() => []),
    getAllScholarships().catch(() => []),
  ]);

  const dynamicPaths = [
    ...universities.map((u) => `/universities/${u.slug}`),
    ...scholarships.map((s) => `/scholarships/${s.slug}`),
  ];

  const allPaths = [...STATIC_PATHS, ...dynamicPaths];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of allPaths) {
    for (const locale of SUPPORTED_LOCALES) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        alternates: { languages: localeAlternates(path) },
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : STATIC_PATHS.includes(path) ? 0.8 : 0.6,
      });
    }
  }

  return entries;
}
