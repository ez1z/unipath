import { describe, it, expect } from 'vitest';
import { formatTuition, formatDate } from '@/lib/format';
import { TMT_PER_USD, TRANSFER_CAP_USD, TRANSFER_CAP_TMT } from '@/lib/constants';

describe('constants', () => {
  it('TMT_PER_USD is 3.51', () => {
    expect(TMT_PER_USD).toBe(3.51);
  });

  it('TRANSFER_CAP_USD is 12000', () => {
    expect(TRANSFER_CAP_USD).toBe(12_000);
  });

  it('TRANSFER_CAP_TMT equals TRANSFER_CAP_USD * TMT_PER_USD', () => {
    expect(TRANSFER_CAP_TMT).toBe(TRANSFER_CAP_USD * TMT_PER_USD);
  });

  it('TRANSFER_CAP_TMT is 42120', () => {
    expect(TRANSFER_CAP_TMT).toBeCloseTo(42_120);
  });
});

describe('formatTuition', () => {
  it('includes dollar sign and USD amount', () => {
    const result = formatTuition(1000);
    expect(result).toContain('$1,000');
  });

  it('includes TMT suffix', () => {
    const result = formatTuition(1000);
    expect(result).toContain('TMT');
  });

  it('converts at fixed 3.51 rate', () => {
    const result = formatTuition(1000);
    const expectedTmt = (1000 * TMT_PER_USD).toLocaleString('ru');
    expect(result).toContain(expectedTmt);
  });

  it('handles zero tuition', () => {
    const result = formatTuition(0);
    expect(result).toContain('$0');
  });

  it('uses separator between USD and TMT values', () => {
    const result = formatTuition(500);
    expect(result).toContain('/');
  });
});

describe('formatDate', () => {
  it('formats as dd.MM.yyyy', () => {
    const date = new Date(2024, 0, 5); // Jan 5, 2024
    expect(formatDate(date)).toBe('05.01.2024');
  });

  it('pads single-digit day and month with zero', () => {
    const date = new Date(2024, 2, 9); // Mar 9, 2024
    expect(formatDate(date)).toBe('09.03.2024');
  });

  it('handles end-of-year dates', () => {
    const date = new Date(2023, 11, 31); // Dec 31, 2023
    expect(formatDate(date)).toBe('31.12.2023');
  });

  it('handles double-digit day and month', () => {
    const date = new Date(2025, 9, 20); // Oct 20, 2025
    expect(formatDate(date)).toBe('20.10.2025');
  });
});
