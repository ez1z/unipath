import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/constants';
import type { Locale } from '@/lib/constants';
import type { University } from '@/lib/data/university-types';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://unipathtm.vercel.app').replace(/\/$/, '');
}

/** Builds hreflang alternates for a locale-agnostic path (e.g. "/universities" or ""). */
export function localeAlternates(path: string) {
  const siteUrl = getSiteUrl();
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = `${siteUrl}/${locale}${path}`;
  }
  languages['x-default'] = `${siteUrl}/${DEFAULT_LOCALE}${path}`;
  return languages;
}

export function canonicalFor(locale: Locale, path: string): string {
  return `${getSiteUrl()}/${locale}${path}`;
}

/** Serializes a JSON-LD object for a <script> tag, escaping "<" so admin-entered
 * fields (university name, website URL, etc.) can't break out of the script tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'UniPath',
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description:
      'Free guide platform helping Turkmen students discover MoE-approved universities abroad and understand the official tuition transfer process.',
    areaServed: 'Turkmenistan',
    email: 'unipathtm@gmail.com',
  };
}

export function websiteJsonLd(locale: Locale) {
  const siteUrl = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'UniPath',
    url: `${siteUrl}/${locale}`,
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${locale}/universities?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function universityJsonLd(university: University, locale: Locale) {
  const siteUrl = getSiteUrl();
  const name = university.name[locale] ?? university.name.en;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name,
    url: `${siteUrl}/${locale}/universities/${university.slug}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: university.city,
      addressCountry: university.country,
    },
    sameAs: [university.official_website].filter(Boolean),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
