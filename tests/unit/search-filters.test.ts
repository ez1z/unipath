import { describe, expect, test } from 'vitest';
import {
  countProgramFilters,
  countUniversityFilters,
  parseProgramFilters,
  parseUniversityFilters,
  serializeProgramFilters,
  serializeUniversityFilters,
  type ProgramFilters,
} from '../../src/lib/search/filters.ts';

const parse = (query: string) => parseProgramFilters(new URLSearchParams(query));

const EMPTY: ProgramFilters = {
  countries: [],
  levels: [],
  fields: [],
  languages: [],
  tuitionMin: null,
  tuitionMax: null,
  lengths: [],
  total: null,
  approvedOnly: false,
  hasScholarships: false,
  sort: 'relevance',
  page: 1,
};

describe('program filters from the URL', () => {
  test('no query means no filters: every level and every field', () => {
    expect(parse('')).toEqual(EMPTY);
  });

  test('reads every filter', () => {
    expect(
      parse(
        'country=gb&country=TR&level=foundation&level=bachelor&field=computing&language=EN' +
          '&min_tuition=1000&max_tuition=9000&length=5%2B&length=3&total=needs-pre-year' +
          '&approved=1&scholarships=1&sort=tuition&page=2',
      ),
    ).toEqual({
      countries: ['GB', 'TR'],
      levels: ['bachelor', 'foundation'],
      fields: ['computing'],
      languages: ['en'],
      tuitionMin: 1000,
      tuitionMax: 9000,
      lengths: ['3', '5+'],
      total: 'needs-pre-year',
      approvedOnly: true,
      hasScholarships: true,
      sort: 'tuition',
      page: 2,
    });
  });

  test('drops invalid values instead of failing', () => {
    expect(
      parse(
        'country=GBR&country=1&level=master&field=magic&language=english&min_tuition=-5' +
          '&max_tuition=abc&length=2&total=soon&approved=yes&sort=random&page=0',
      ),
    ).toEqual(EMPTY);
    expect(parse('page=999999').page).toBe(1);
    expect(parse('max_tuition=2000000').tuitionMax).toBeNull();
  });

  test('de-duplicates and orders lists, so equal filters give one cache key', () => {
    const a = parse('level=language&level=bachelor&level=language&country=TR&country=GB');
    const b = parse('country=GB&level=bachelor&country=tr&level=language');
    expect(a).toEqual(b);
    expect(serializeProgramFilters(a).toString()).toBe(serializeProgramFilters(b).toString());
    expect(a.levels).toEqual(['bachelor', 'language']);
  });

  test('swaps a minimum that is above the maximum', () => {
    const f = parse('min_tuition=9000&max_tuition=1000');
    expect([f.tuitionMin, f.tuitionMax]).toEqual([1000, 9000]);
  });

  test('caps each list at 12 values', () => {
    const many = Array.from(
      { length: 30 },
      (_, i) =>
        `country=${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
    ).join('&');
    expect(parse(many).countries).toHaveLength(12);
  });

  test('serializing and parsing again gives the same filters, defaults left out', () => {
    const f = parse('country=TR&level=bachelor&total=4-or-less&sort=ranking&page=3&approved=1');
    expect(parseProgramFilters(serializeProgramFilters(f))).toEqual(f);
    expect(serializeProgramFilters(EMPTY).toString()).toBe('');
    expect(serializeProgramFilters({ ...EMPTY, sort: 'relevance', page: 1 }).toString()).toBe('');
  });

  test('counts set filters for the Filters button, ignoring sort and page', () => {
    expect(countProgramFilters(EMPTY)).toBe(0);
    expect(countProgramFilters(parse('country=TR&country=GB&approved=1&sort=tuition&page=2'))).toBe(
      3,
    );
  });
});

describe('university filters from the URL', () => {
  test('reads country, Ministry status, foundation year and scholarships', () => {
    const f = parseUniversityFilters(
      new URLSearchParams('country=hu&status=unchecked&status=approved&status=bogus&foundation=1'),
    );
    expect(f).toEqual({
      countries: ['HU'],
      statuses: ['approved', 'unchecked'],
      hasFoundationYear: true,
      hasScholarships: false,
      page: 1,
    });
    expect(parseUniversityFilters(serializeUniversityFilters(f))).toEqual(f);
    expect(countUniversityFilters(f)).toBe(4);
  });

  test('country and scholarships keep their meaning when switching tabs', () => {
    const query = new URLSearchParams('country=TR&scholarships=1&level=bachelor');
    expect(parseUniversityFilters(query).countries).toEqual(parseProgramFilters(query).countries);
    expect(parseUniversityFilters(query).hasScholarships).toBe(true);
  });
});
