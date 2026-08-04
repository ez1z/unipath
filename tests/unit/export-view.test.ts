import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyView, DEFAULT_VIEW, EMPTY_FILTERS, type ListFilters, type ListView } from '@/lib/list/view';
import { buildRow, cellText, type ListRow, type RowContext } from '@/lib/list/row-view';
import { newEntry, type ColumnDef } from '@/lib/data/list-types';
import type { University } from '@/lib/data/university-types';
import type { Semester } from '@/lib/types/semester';

/**
 * `row-view.ts` promises that "the exported file genuinely matches what the
 * student was looking at". Filtering and sorting would quietly break that
 * promise if the export were built from the unfiltered rows, so this pins the
 * composition the list page performs: rows → applyView → cellText.
 *
 * The wiring inside ListClient itself is not covered here — the project has no
 * component-test setup — so this guards the contract, not the call site.
 */

const TODAY = new Date('2026-08-05T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

let idCounter = 0;
const nextId = () => `5c1e9a72-8b30-4d6e-9f21-77a1b4c5${String(++idCounter).padStart(4, '0')}`;

const semester = (name: string, deadline: string | null): Semester => ({
  name,
  start_date: '2026-09-15',
  deadline,
  language: null,
  major: null,
});

function uni(name: string, over: Partial<University> = {}): University {
  return {
    id: nextId(),
    slug: 'test',
    name: { en: name, ru: name, tk: name },
    country: 'Turkey',
    city: 'Ankara',
    tuition_usd: 10_000,
    tuition_usd_max: null,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    moe_approved: false,
    ranking_qs: null,
    languages: [],
    majors: [],
    official_website: '',
    application_portal_url: '',
    entrance_requirements: {},
    semesters: [],
    tuition_options: [],
    ...over,
  };
}

function row(university: University, semesterKey: string | null = null): ListRow {
  return buildRow(
    { ...newEntry(university.id, 0), semester_key: semesterKey },
    university,
    { tier: null, flags: [] },
    undefined,
    new Map(),
  );
}

const t = ((key: string) => key) as RowContext['t'];
const ctx: RowContext = { locale: 'en', t, scholarshipsById: new Map() };

const nameColumn: ColumnDef = { id: 'university', kind: 'fixed' };
const deadlineColumn: ColumnDef = { id: 'deadline', kind: 'fixed' };

/** What ListClient hands to the export endpoint. */
function exportBody(rows: ListRow[], columns: ColumnDef[], view: ListView, filters: ListFilters) {
  return applyView(rows, view, filters, 'en').map((r) => columns.map((c) => cellText(c, r, ctx)));
}

describe('export body follows the visible view', () => {
  const rows = () => [
    row(uni('Bilkent', { country: 'Turkey', tuition_usd: 20_000 })),
    row(uni('Warsaw Tech', { country: 'Poland', tuition_usd: 5_000 })),
    row(uni('Ankara Uni', { country: 'Turkey', tuition_usd: 12_000 })),
  ];

  it('exports every row when nothing is filtered or sorted', () => {
    const body = exportBody(rows(), [nameColumn], DEFAULT_VIEW, EMPTY_FILTERS);
    expect(body).toHaveLength(3);
  });

  it('omits rows the filters hide', () => {
    const body = exportBody(rows(), [nameColumn], DEFAULT_VIEW, {
      ...EMPTY_FILTERS,
      countries: ['Turkey'],
    });
    expect(body).toHaveLength(2);
    expect(body.flat().join(' ')).not.toContain('Warsaw');
  });

  it('writes rows in the sorted order, not the stored one', () => {
    const body = exportBody(
      rows(),
      [nameColumn],
      { sort: { columnId: 'tuition', dir: 'asc' } },
      EMPTY_FILTERS,
    );
    expect(body.map((r) => r[0].split(' —')[0])).toEqual([
      'Warsaw Tech',
      'Ankara Uni',
      'Bilkent',
    ]);
  });

  it('produces an empty body when the filters match nothing', () => {
    expect(
      exportBody(rows(), [nameColumn], DEFAULT_VIEW, { ...EMPTY_FILTERS, query: 'nonexistent' }),
    ).toEqual([]);
  });
});

describe('exported deadline names the chosen intake', () => {
  const semesters = [semester('Fall 2026', '2026-08-25'), semester('Spring 2027', '2026-12-01')];

  it('exports the auto-picked intake when the student chose none', () => {
    const body = exportBody([row(uni('Multi', { semesters }))], [deadlineColumn], DEFAULT_VIEW, EMPTY_FILTERS);
    expect(body[0][0]).toBe('Fall 2026 · 25.08.2026');
  });

  /**
   * Three "Fall" deadlines in a spreadsheet are indistinguishable without the
   * intake name, which is why the exported cell carries both.
   */
  it('exports the intake the student actually chose', () => {
    const body = exportBody(
      [row(uni('Multi', { semesters }), 'Spring 2027|2026-09-15')],
      [deadlineColumn],
      DEFAULT_VIEW,
      EMPTY_FILTERS,
    );
    expect(body[0][0]).toBe('Spring 2027 · 01.12.2026');
  });

  it('exports the bare intake name when its deadline is unpublished', () => {
    const undated = [semester('Fall 2027', null)];
    const body = exportBody(
      [row(uni('Undated', { semesters: undated }), 'Fall 2027|2026-09-15')],
      [deadlineColumn],
      DEFAULT_VIEW,
      EMPTY_FILTERS,
    );
    expect(body[0][0]).toBe('Fall 2027');
  });
});
