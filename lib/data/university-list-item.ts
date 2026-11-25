import type { University } from './university-types';

/**
 * What a list card shows: the fields UniversityCard reads. Full `University`
 * objects satisfy it too, so the home page can keep passing them.
 */
export type UniversityCardData = Pick<
  University,
  | 'id'
  | 'slug'
  | 'name'
  | 'country'
  | 'city'
  | 'tuition_usd'
  | 'tuition_usd_max'
  | 'acceptance_rate_min'
  | 'acceptance_rate_max'
  | 'moe_approved'
  | 'ranking_qs'
  | 'languages'
  | 'entrance_requirements'
>;

/**
 * A university row as the /universities list needs it: the card fields plus
 * what filtering, sorting and personalisation read (majors, deadlines, tests).
 *
 * The list page sends every university to the browser, so the heavy fields
 * (documents and other entrance requirement details, tuition options, semester
 * names and dates, websites) stay on the server. They're only shown on the
 * detail page.
 */
export type UniversityListItem = UniversityCardData &
  Pick<University, 'majors'> & {
    /** Only the `tests` array is kept, unchanged, for the card and the scores filter. */
    entrance_requirements: { tests?: unknown[] };
    /** Only semesters with a deadline, and only the deadline. */
    semesters: { deadline: string }[];
  };

export function toUniversityListItem(u: University): UniversityListItem {
  const tests = u.entrance_requirements?.tests;
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    country: u.country,
    city: u.city,
    tuition_usd: u.tuition_usd,
    tuition_usd_max: u.tuition_usd_max,
    acceptance_rate_min: u.acceptance_rate_min,
    acceptance_rate_max: u.acceptance_rate_max,
    moe_approved: u.moe_approved,
    ranking_qs: u.ranking_qs,
    languages: u.languages,
    majors: u.majors,
    entrance_requirements: Array.isArray(tests) ? { tests } : {},
    // Semesters without a deadline never count for the deadline sort or the
    // upcoming/passed filters (getNextDeadline and filterUniversities only
    // look at non-null deadlines), so dropping them changes no result.
    semesters: u.semesters.flatMap((s) => (s.deadline !== null ? [{ deadline: s.deadline }] : [])),
  };
}
