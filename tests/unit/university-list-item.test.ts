import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toUniversityListItem } from '@/lib/data/university-list-item';
import { filterUniversities } from '@/lib/data/filter-universities';
import { meetsTestRequirements, testsOf, type UserScores } from '@/lib/data/test-requirements';
import { getNextDeadline } from '@/lib/types/semester';
import type { FilterParams, University } from '@/lib/data/university-types';

const TODAY = new Date('2026-08-05T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeUni(overrides: Partial<University> = {}): University {
  return {
    id: '1',
    slug: 'default-university',
    name: { en: 'Default University', ru: 'Университет', tk: 'Uniwersitet' },
    country: 'Turkey',
    city: 'Ankara',
    tuition_usd: 5000,
    tuition_usd_max: null,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    moe_approved: false,
    ranking_qs: null,
    languages: ['en'],
    majors: ['Engineering'],
    official_website: 'https://example.edu',
    application_portal_url: 'https://apply.example.edu',
    entrance_requirements: {},
    semesters: [],
    tuition_options: [],
    ...overrides,
  };
}

const semester = (name: string, deadline: string | null) => ({
  name,
  start_date: '2026-09-15',
  deadline,
  language: null,
  major: null,
});

const unis: University[] = [
  makeUni({
    id: '1',
    slug: 'mit',
    name: { en: 'MIT', ru: 'МИТ', tk: 'MIT' },
    country: 'USA',
    city: 'Cambridge',
    tuition_usd: 60000,
    tuition_usd_max: 62000,
    acceptance_rate_min: 4,
    acceptance_rate_max: 5,
    moe_approved: true,
    ranking_qs: 1,
    majors: ['Engineering', 'Computer Science'],
    entrance_requirements: {
      tests: [{ type: 'toefl', min_score: 90 }, { type: 'sat', min_math: 700, min_verbal: 650 }],
      documents: ['Passport', 'Transcript'],
      notes: 'Apply early.',
    },
    semesters: [semester('Fall 2026', '2026-08-25'), semester('Spring 2027', null)],
    tuition_options: [{ label: 'Standard', amount_usd: 60000 } as never],
  }),
  makeUni({
    id: '2',
    slug: 'msu',
    name: { en: 'Moscow State University', ru: 'МГУ', tk: 'MGU' },
    country: 'Russia',
    city: 'Moscow',
    tuition_usd: 4000,
    languages: ['ru'],
    majors: ['Medicine', 'Law'],
    entrance_requirements: { tests: [{ type: 'ielts', min_score: 6 }] },
    // Only passed deadlines, plus one semester without a deadline.
    semesters: [semester('Fall 2025', '2025-07-01'), semester('Fall 2026', null)],
  }),
  makeUni({
    id: '3',
    slug: 'ankara',
    name: { en: 'Ankara University', ru: 'Анкарский Университет', tk: 'Ankara Uni' },
    languages: ['tr', 'en'],
    majors: ['Computer Science'],
    moe_approved: true,
    // No deadlines at all: neither "upcoming" nor "passed".
    semesters: [semester('Fall 2026', null)],
  }),
  makeUni({
    id: '4',
    slug: 'odd-requirements',
    name: { en: 'Odd Requirements College', ru: 'Колледж', tk: 'Kollej' },
    // A malformed tests value must behave like "no tests" in both shapes.
    entrance_requirements: { tests: 'IELTS 6', documents: ['Passport'] },
    semesters: [semester('Spring 2027', '2026-12-01'), semester('Fall 2027', '2027-06-01')],
  }),
];

describe('toUniversityListItem', () => {
  it('keeps the card, filter and sort fields as they are', () => {
    const item = toUniversityListItem(unis[0]);
    expect(item).toMatchObject({
      id: '1',
      slug: 'mit',
      name: { en: 'MIT', ru: 'МИТ', tk: 'MIT' },
      country: 'USA',
      city: 'Cambridge',
      tuition_usd: 60000,
      tuition_usd_max: 62000,
      acceptance_rate_min: 4,
      acceptance_rate_max: 5,
      moe_approved: true,
      ranking_qs: 1,
      languages: ['en'],
      majors: ['Engineering', 'Computer Science'],
    });
  });

  it('drops the heavy fields', () => {
    const item = toUniversityListItem(unis[0]) as Record<string, unknown>;
    expect(item).not.toHaveProperty('tuition_options');
    expect(item).not.toHaveProperty('official_website');
    expect(item).not.toHaveProperty('application_portal_url');
    expect(item.entrance_requirements).not.toHaveProperty('documents');
    expect(item.entrance_requirements).not.toHaveProperty('notes');
  });

  it('keeps the tests array entries unchanged', () => {
    const item = toUniversityListItem(unis[0]);
    expect(item.entrance_requirements).toEqual({ tests: unis[0].entrance_requirements.tests });
    expect(testsOf(item)).toEqual(testsOf(unis[0]));
  });

  it('leaves out tests when there is no tests array', () => {
    expect(toUniversityListItem(unis[2]).entrance_requirements).toEqual({});
    expect(toUniversityListItem(unis[3]).entrance_requirements).toEqual({});
    expect(testsOf(toUniversityListItem(unis[3]))).toEqual([]);
  });

  it('keeps only the deadlines of semesters that have one', () => {
    expect(toUniversityListItem(unis[0]).semesters).toEqual([{ deadline: '2026-08-25' }]);
    expect(toUniversityListItem(unis[2]).semesters).toEqual([]);
    expect(toUniversityListItem(unis[3]).semesters).toEqual([
      { deadline: '2026-12-01' },
      { deadline: '2027-06-01' },
    ]);
  });

  it('gives the same next deadline as the full row', () => {
    for (const u of unis) {
      expect(getNextDeadline(toUniversityListItem(u).semesters)).toBe(getNextDeadline(u.semesters));
    }
  });

  it('filters to the same universities as the full rows', () => {
    const items = unis.map(toUniversityListItem);
    const cases: FilterParams[] = [
      {},
      { deadlineStatus: 'upcoming' },
      { deadlineStatus: 'passed' },
      { moeOnly: true },
      { rankedOnly: true },
      { country: 'Russia' },
      { language: 'en' },
      { major: 'comput' },
      { maxTuition: 5000 },
      { query: 'мгу' },
      { query: 'ankara', moeOnly: true, deadlineStatus: 'upcoming' },
    ];
    for (const params of cases) {
      const ids = (list: { id: string }[]) => list.map((u) => u.id);
      expect(ids(filterUniversities(items, params))).toEqual(ids(filterUniversities(unis, params)));
    }
    // Sanity check that the deadline cases really split the sample.
    expect(filterUniversities(items, { deadlineStatus: 'upcoming' }).map((u) => u.id)).toEqual(['1', '4']);
    expect(filterUniversities(items, { deadlineStatus: 'passed' }).map((u) => u.id)).toEqual(['2']);
  });

  it('meets test requirements exactly when the full row does', () => {
    const scoreSets: UserScores[] = [
      { toefl: null, ielts: null, sat: null, duolingo: null },
      { toefl: 95, ielts: null, sat: null, duolingo: null },
      { toefl: null, ielts: 6.5, sat: 1200, duolingo: null },
      { toefl: 80, ielts: 5.5, sat: 1400, duolingo: 120 },
    ];
    for (const u of unis) {
      for (const scores of scoreSets) {
        expect(meetsTestRequirements(toUniversityListItem(u), scores)).toBe(meetsTestRequirements(u, scores));
      }
    }
  });

  it('is much smaller once serialised', () => {
    const heavy = makeUni({
      majors: Array.from({ length: 40 }, (_, i) => `Major ${i}`),
      entrance_requirements: {
        tests: [{ type: 'ielts', min_score: 6 }],
        documents: Array.from({ length: 10 }, (_, i) => `A fairly long document requirement number ${i}`),
        notes: 'x'.repeat(500),
      },
      semesters: [semester('Fall 2026', '2026-08-25'), semester('Spring 2027', '2026-12-01')],
      tuition_options: Array.from({ length: 4 }, () => ({ label: 'Programme', amount_usd: 1000 }) as never),
    });
    expect(JSON.stringify(toUniversityListItem(heavy)).length).toBeLessThan(JSON.stringify(heavy).length * 0.6);
  });
});
