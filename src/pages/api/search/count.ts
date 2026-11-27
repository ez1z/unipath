import type { APIRoute } from 'astro';
import { getTranslations, isLang } from '../../../i18n';
import { countKind } from '../../../lib/cache';
import { searchScholarships } from '../../../lib/db/catalog';
import { searchPrograms, searchUniversities } from '../../../lib/db/queries';
import {
  parseProgramFilters,
  parseScholarshipFilters,
  parseUniversityFilters,
} from '../../../lib/search/filters';
import { getDb, today } from '../../../lib/server';

export const prerender = false;

/**
 * Live result count for the filter sheet: `{ total, label }`, where label is the
 * translated "Show N results". Read-only; cached for 60 s per canonical query
 * (lib/cache.ts), like the search pages themselves.
 */
export const GET: APIRoute = async ({ url }) => {
  const params = url.searchParams;
  const kind = countKind(params);
  const lang = params.get('lang');
  if (!kind || !isLang(lang)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  const db = getDb();
  const options = { lang, today: today(), pageSize: 1 };
  const page =
    kind === 'programs'
      ? await searchPrograms(db, { ...parseProgramFilters(params), page: 1 }, options)
      : kind === 'universities'
        ? await searchUniversities(db, { ...parseUniversityFilters(params), page: 1 }, options)
        : await searchScholarships(db, { ...parseScholarshipFilters(params), page: 1 }, options);
  const t = getTranslations(lang);
  return Response.json({ total: page.total, label: t('search.applyCount', { n: page.total }) });
};
