import { describe, expect, test } from 'vitest';
import { listText } from '../../src/lib/view.ts';
import {
  formatDate,
  formatMonth,
  formatNumber,
  formatTmt,
  formatUsd,
  languageName,
  nextIntake,
  usdToTmt,
} from '../../src/lib/format.ts';

describe('money', () => {
  test('USD in whole dollars, per page language', () => {
    expect(formatUsd('en', 12500)).toBe('$12,500');
    expect(formatUsd('ru', 12500).replace(/\s/g, ' ')).toMatch(/^12 500 \$$/);
  });

  test('TMT only with a valid rate', () => {
    const rate = { rate: 19.5, date: '2026-11-01' };
    expect(usdToTmt(1000, rate)).toBe(19500);
    expect(usdToTmt(1000, null)).toBeNull();
    expect(usdToTmt(1000, { rate: 0, date: '2026-11-01' })).toBeNull();
    expect(usdToTmt(1000, { rate: Number.NaN, date: '2026-11-01' })).toBeNull();
    expect(formatTmt('en', 19500)).toContain('19,500');
  });
});

describe('dates', () => {
  test('a calendar date never shifts a day, whatever the time zone', () => {
    expect(formatDate('en', '2026-12-01')).toBe('Dec 1, 2026');
    expect(formatDate('en', '2026-01-31')).toBe('Jan 31, 2026');
  });

  test("next intake: the next month still ahead, else next year's first", () => {
    expect(nextIntake([9, 2], '2026-11-28')).toBe(2);
    expect(nextIntake([9, 2], '2026-05-10')).toBe(9);
    expect(nextIntake([9], '2026-09-15')).toBe(9);
    expect(nextIntake([], '2026-05-10')).toBeNull();
    expect(nextIntake([0, 13, 2.5], '2026-05-10')).toBeNull();
  });
});

describe('languageName', () => {
  test('names a teaching language in the page language, else shows the code', () => {
    expect(languageName('en', 'tr')).toBe('Turkish');
    expect(languageName('ru', 'en')).toBe('английский');
    expect(languageName('en', '!!')).toBe('!!');
  });
});

describe('Turkmen without Intl locale data (the Workers runtime has none)', () => {
  test('formats dates, months, numbers, money, languages and lists itself', () => {
    const nbsp = String.fromCharCode(0xa0);
    expect(formatDate('tk', '2027-01-27')).toBe('27 ýan 2027');
    expect(formatMonth('tk', 9)).toBe('Sentýabr');
    expect(formatNumber('tk', 3.5)).toBe('3,5');
    expect(formatNumber('tk', 12000)).toBe(`12${nbsp}000`);
    expect(formatUsd('tk', 6000)).toBe(`6${nbsp}000${nbsp}US$`);
    expect(formatTmt('tk', 21000)).toBe(`21${nbsp}000${nbsp}TMT`);
    expect(languageName('tk', 'en')).toBe('iňlis dili');
    expect(languageName('tk', 'tr')).toBe('türk dili');
    expect(listText('tk', ['a', 'b', 'c'])).toBe('a, b we c');
  });
});
