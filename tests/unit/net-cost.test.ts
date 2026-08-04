import { describe, it, expect } from 'vitest';
import { buildRow } from '@/lib/list/row-view';
import { newEntry } from '@/lib/data/list-types';
import type { University } from '@/lib/data/university-types';
import type { Scholarship } from '@/lib/data/scholarship-types';

const UNI_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const SCH_ID = '5c1e9a72-8b30-4d6e-9f21-77a1b4c5d6e2';
const SCH_ID_2 = '9d7b1c34-2a56-4e8f-8c03-1b2d3e4f5a60';

function uni(tuition: number, tuitionMax: number | null = null): University {
  return {
    id: UNI_ID,
    slug: 'test',
    name: { en: 'Test', ru: 'Test', tk: 'Test' },
    country: 'USA',
    city: 'Somewhere',
    tuition_usd: tuition,
    tuition_usd_max: tuitionMax,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    moe_approved: true,
    ranking_qs: null,
    languages: [],
    majors: [],
    official_website: '',
    application_portal_url: '',
    entrance_requirements: {},
    semesters: [],
    tuition_options: [],
  };
}

function scholarship(id: string, amount: number | null, amountMax: number | null = null): Scholarship {
  return {
    id,
    slug: 's',
    university_id: UNI_ID,
    country: 'USA',
    name: { en: 'Aid', ru: 'Aid', tk: 'Aid' },
    type: 'need-based',
    coverage: [],
    amount_usd: amount,
    amount_usd_max: amountMax,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    deadline_text: null,
    semesters: [],
    requirements: {},
    description: { en: '', ru: '', tk: '' },
    application_url: '',
  };
}

const noFit = { tier: null, flags: [] };

function build(u: University, linked: Scholarship[]) {
  const entry = { ...newEntry(UNI_ID, 0), scholarship_ids: linked.map((s) => s.id) };
  const byId = new Map(linked.map((s) => [s.id, s]));
  return buildRow(entry, u, noFit, undefined, byId);
}

describe('net cost — no scholarships linked', () => {
  it('is just the tuition range', () => {
    const row = build(uni(10_000, 20_000), []);
    expect(row.netCostMinUsd).toBe(10_000);
    expect(row.netCostMaxUsd).toBe(20_000);
  });

  it('collapses to one figure when tuition has no range', () => {
    const row = build(uni(10_000), []);
    expect(row.netCostMinUsd).toBe(10_000);
    expect(row.netCostMaxUsd).toBe(10_000);
  });
});

describe('net cost — the MIT case that used to print $0', () => {
  /**
   * Real data: tuition $64,310–$92,760 with a $64,310 need-based award. The old
   * formula subtracted the award from the *minimum* tuition and clamped, so it
   * claimed the school was free. The worst case is what a student must plan for.
   */
  it('still shows a real upper bound when the award only covers minimum tuition', () => {
    const row = build(uni(64_310, 92_760), [scholarship(SCH_ID, 64_310)]);
    expect(row.netCostMinUsd).toBe(0);
    expect(row.netCostMaxUsd).toBe(28_450);
  });

  it('is genuinely zero only when the award covers the dearest tuition', () => {
    const row = build(uni(72_722, 95_770), [scholarship(SCH_ID, 95_770)]);
    expect(row.netCostMinUsd).toBe(0);
    expect(row.netCostMaxUsd).toBe(0);
  });
});

describe('net cost — award ranges', () => {
  it('pairs the largest award with the cheapest tuition for the best case', () => {
    const row = build(uni(5_000, 9_000), [scholarship(SCH_ID, 2_000, 8_000)]);
    expect(row.netCostMinUsd).toBe(0);
  });

  it('pairs the smallest award with the dearest tuition for the worst case', () => {
    const row = build(uni(5_000, 9_000), [scholarship(SCH_ID, 2_000, 8_000)]);
    expect(row.netCostMaxUsd).toBe(7_000);
  });

  it('sums multiple linked awards', () => {
    const row = build(uni(10_000), [
      scholarship(SCH_ID, 3_000),
      scholarship(SCH_ID_2, 2_000),
    ]);
    expect(row.netCostMaxUsd).toBe(5_000);
  });

  it('treats a scholarship with no stated amount as covering nothing', () => {
    const row = build(uni(10_000), [scholarship(SCH_ID, null)]);
    expect(row.netCostMinUsd).toBe(10_000);
    expect(row.netCostMaxUsd).toBe(10_000);
  });

  it('never goes negative when the award exceeds tuition', () => {
    const row = build(uni(343, 1_718), [scholarship(SCH_ID, 2_577, 8_522)]);
    expect(row.netCostMinUsd).toBe(0);
    expect(row.netCostMaxUsd).toBe(0);
  });
});
