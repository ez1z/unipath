import { describe, it, expect } from 'vitest';
import {
  formatUsd,
  formatTmt,
  formatRange,
  formatTuition,
  formatTuitionRange,
  formatOldManat,
  formatOldManatRange,
  computeTuitionBreakdown,
} from '@/lib/format';

const DASH = '–'; // en-dash used as the range separator
const words = { billion: 'mlrd', million: 'mln', thousand: 'müň' };

describe('formatUsd / formatTmt', () => {
  it('formats USD with a leading $ and grouping', () => {
    expect(formatUsd(5000)).toBe('$5,000');
  });

  it('formats TMT with a trailing TMT label', () => {
    expect(formatTmt(17_550)).toMatch(/TMT$/);
  });
});

describe('formatRange', () => {
  it('returns a single value when max is null', () => {
    expect(formatRange(5000, null, formatUsd)).toBe('$5,000');
  });

  it('returns a single value when max is undefined', () => {
    expect(formatRange(5000, undefined, formatUsd)).toBe('$5,000');
  });

  it('collapses to a single value when max equals min', () => {
    expect(formatRange(5000, 5000, formatUsd)).toBe('$5,000');
  });

  it('collapses to a single value when max is less than min', () => {
    expect(formatRange(5000, 3000, formatUsd)).toBe('$5,000');
  });

  it('renders a range when max is greater than min', () => {
    expect(formatRange(5000, 8000, formatUsd)).toBe(`$5,000 ${DASH} $8,000`);
  });
});

describe('formatTuitionRange', () => {
  it('matches single-value formatTuition when there is no max', () => {
    expect(formatTuitionRange(5000, null)).toBe(formatTuition(5000));
  });

  it('renders USD and TMT both as ranges when a max is present', () => {
    const out = formatTuitionRange(5000, 8000);
    expect(out).toContain(`$5,000 ${DASH} $8,000`);
    expect(out).toContain(' / ');
    expect((out.match(new RegExp(DASH, 'g')) ?? []).length).toBe(2); // USD range + TMT range
    expect(out).toContain('TMT');
  });
});

describe('formatOldManat / formatOldManatRange', () => {
  it('spells out a breakdown using the provided words', () => {
    const bd = computeTuitionBreakdown(5000);
    const text = formatOldManat(bd, words);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('returns the single value when there is no upper breakdown', () => {
    const bd = computeTuitionBreakdown(5000);
    expect(formatOldManatRange(bd, null, words)).toBe(formatOldManat(bd, words));
  });

  it('collapses to a single value when both breakdowns are identical', () => {
    const bd = computeTuitionBreakdown(5000);
    expect(formatOldManatRange(bd, bd, words)).toBe(formatOldManat(bd, words));
  });

  it('renders a range when the two breakdowns differ', () => {
    const bdMin = computeTuitionBreakdown(5000);
    const bdMax = computeTuitionBreakdown(8000);
    const out = formatOldManatRange(bdMin, bdMax, words);
    expect(out).toContain(DASH);
    expect(out).toContain(formatOldManat(bdMin, words));
    expect(out).toContain(formatOldManat(bdMax, words));
  });
});
