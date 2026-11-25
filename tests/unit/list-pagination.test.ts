import { describe, it, expect } from 'vitest';
import {
  LIST_PAGE_SIZE,
  clampShowCount,
  nextShowCount,
  parseShowParam,
  showParamValue,
} from '@/lib/data/list-pagination';

describe('parseShowParam', () => {
  it('uses one page when the param is missing or empty', () => {
    expect(LIST_PAGE_SIZE).toBe(24);
    expect(parseShowParam(null)).toBe(24);
    expect(parseShowParam(undefined)).toBe(24);
    expect(parseShowParam('')).toBe(24);
  });

  it('accepts whole pages as they are', () => {
    expect(parseShowParam('24')).toBe(24);
    expect(parseShowParam('48')).toBe(48);
    expect(parseShowParam('240')).toBe(240);
  });

  it('rounds other positive integers up to a whole page', () => {
    expect(parseShowParam('1')).toBe(24);
    expect(parseShowParam('25')).toBe(48);
    expect(parseShowParam('60')).toBe(72);
  });

  it('ignores values that are not positive integers', () => {
    for (const raw of ['0', '-48', '48.5', '1e3', 'abc', '48abc', ' ', 'NaN', 'Infinity']) {
      expect(parseShowParam(raw)).toBe(24);
    }
  });

  it('caps absurd values', () => {
    expect(parseShowParam('99999999999999999999999')).toBe(10_008);
    expect(parseShowParam('10000')).toBe(10_008);
  });
});

describe('clampShowCount', () => {
  it('never shows more pages than the results fill', () => {
    expect(clampShowCount(96, 40)).toBe(48);
    expect(clampShowCount(96, 48)).toBe(48);
    expect(clampShowCount(96, 312)).toBe(96);
  });

  it('keeps at least one page, even with no results', () => {
    expect(clampShowCount(96, 0)).toBe(24);
    expect(clampShowCount(24, 5)).toBe(24);
  });
});

describe('nextShowCount', () => {
  it('adds one page', () => {
    expect(nextShowCount(24, 312)).toBe(48);
    expect(nextShowCount(48, 312)).toBe(72);
  });

  it('stops at the page that holds the last result', () => {
    expect(nextShowCount(24, 30)).toBe(48);
    expect(nextShowCount(48, 30)).toBe(48);
  });
});

describe('showParamValue', () => {
  it('is left out of the URL at the default', () => {
    expect(showParamValue(24)).toBeNull();
  });

  it('is written above the default', () => {
    expect(showParamValue(48)).toBe('48');
  });
});
