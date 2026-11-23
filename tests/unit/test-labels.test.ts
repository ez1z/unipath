import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  describeTest,
  humanizeTestType,
  isEmptyTestEntry,
  normalizeTestType,
  summarizeTests,
  testScoreText,
  TEST_LABEL_KEYS,
  type TestLabel,
} from '@/lib/data/test-labels';
import type { TestEntry } from '@/lib/data/fit';

/** Stand-in translator: the label key itself, or the humanized fallback. */
const keyOrFallback = (d: TestLabel) => d.labelKey ?? d.fallback;

describe('normalizeTestType', () => {
  it('keeps the four core tests as they are', () => {
    expect(['toefl', 'ielts', 'sat', 'duolingo'].map(normalizeTestType)).toEqual([
      'toefl',
      'ielts',
      'sat',
      'duolingo',
    ]);
  });

  it('folds spelling variants into one key', () => {
    expect(normalizeTestType('pte_academic')).toBe('pte');
    expect(normalizeTestType('cambridge_cae_cpe')).toBe('cambridge');
    expect(normalizeTestType('cambridge c2 proficiency')).toBe('cambridge');
    expect(normalizeTestType('english_proficiency')).toBe('english');
    expect(normalizeTestType('spanish (dele/siele)')).toBe('dele_siele');
    expect(normalizeTestType('letter of motivation')).toBe('letter_of_motivation');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeTestType('  TOEFL ')).toBe('toefl');
    expect(normalizeTestType('PTE Academic')).toBe('pte');
  });

  it('keeps distinct exams distinct', () => {
    expect(normalizeTestType('toefl_essentials')).toBe('toefl_essentials');
    expect(normalizeTestType('teps_new')).toBe('teps_new');
    expect(normalizeTestType('tr_yos')).toBe('tr_yos');
    expect(normalizeTestType('institutional_yos')).toBe('institutional_yos');
  });

  it('returns an empty string for a missing or non-string type', () => {
    expect(normalizeTestType(undefined)).toBe('');
    expect(normalizeTestType(42)).toBe('');
  });
});

describe('humanizeTestType', () => {
  it('upper-cases a short single-word acronym', () => {
    expect(humanizeTestType('gre')).toBe('GRE');
    expect(humanizeTestType('ucat')).toBe('UCAT');
  });

  it('turns underscores into spaces and capitalises the first letter', () => {
    expect(humanizeTestType('michigan_english_test')).toBe('Michigan english test');
  });

  it('leaves strings that already carry capitals as written', () => {
    expect(humanizeTestType('DSH-2')).toBe('DSH-2');
    expect(humanizeTestType('Oxford_Test_of_English')).toBe('Oxford Test of English');
  });

  it('never returns undefined', () => {
    expect(humanizeTestType(null)).toBe('');
    expect(humanizeTestType('   ')).toBe('');
  });
});

describe('testScoreText', () => {
  it('totals SAT math and verbal', () => {
    expect(testScoreText({ type: 'sat', min_math: 600, min_verbal: 580 })).toBe('1180');
  });

  it('uses one SAT section when only that one is given', () => {
    expect(testScoreText({ type: 'sat', min_math: 650 })).toBe('650');
  });

  it('falls back to a single SAT min_score', () => {
    expect(testScoreText({ type: 'sat', min_score: 1000 })).toBe('1000');
  });

  it('returns min_score as given, decimals included', () => {
    expect(testScoreText({ type: 'ielts', min_score: 6.5 })).toBe('6.5');
    expect(testScoreText({ type: 'pte', min_score: 59 })).toBe('59');
  });

  it('uses min_level for exams graded by level', () => {
    expect(testScoreText({ type: 'spanish (dele/siele)', min_level: 'B1' })).toBe('B1');
  });

  it('returns null when no minimum is given', () => {
    expect(testScoreText({ type: 'toeic', min_score: null })).toBeNull();
    expect(testScoreText({ type: 'duolingo' })).toBeNull();
    expect(testScoreText({ type: 'sat' })).toBeNull();
  });
});

describe('describeTest', () => {
  it('labels a core test with its existing key', () => {
    expect(describeTest({ type: 'toefl', format: 'ibt', min_score: 79 })).toMatchObject({
      key: 'toefl',
      labelKey: 'test_abbr_toefl',
      score: '79',
      isTest: true,
      isCore: true,
    });
  });

  it('labels a known non-core exam through its alias', () => {
    expect(describeTest({ type: 'cambridge c2 proficiency', min_score: 180 })).toMatchObject({
      key: 'cambridge',
      labelKey: 'test_abbr_cambridge',
      score: '180',
      isTest: true,
      isCore: false,
    });
  });

  it('falls back to a humanized name for an unknown type', () => {
    const d = describeTest({ type: 'michigan_english_test', min_score: 56 });
    expect(d.labelKey).toBeNull();
    expect(d.fallback).toBe('Michigan english test');
    expect(d.isTest).toBe(true);
  });

  it('marks essays, institution facts and "other" as non-tests', () => {
    for (const type of ['other', 'personal_statement', 'supplemental', 'letter of motivation', 'womens_college']) {
      const d = describeTest({ type });
      expect(d.isTest, type).toBe(false);
      expect(d.labelKey, type).not.toBeNull();
    }
  });

  it('carries the note through, trimmed, and drops blank notes', () => {
    expect(describeTest({ type: 'hsk', note: ' HSK 5 ' }).note).toBe('HSK 5');
    expect(describeTest({ type: 'hsk', note: '  ' }).note).toBeNull();
  });

  it('treats an entry without a type as "other"', () => {
    const d = describeTest({ note: 'See the admissions page' } as unknown as TestEntry);
    expect(d.key).toBe('other');
    expect(d.isTest).toBe(false);
    expect(isEmptyTestEntry(d)).toBe(false);
    expect(isEmptyTestEntry(describeTest({} as unknown as TestEntry))).toBe(true);
  });
});

describe('summarizeTests', () => {
  it('lists core tests exactly as before', () => {
    const tests: TestEntry[] = [
      { type: 'toefl', format: 'ibt', min_score: 80 },
      { type: 'ielts', min_score: 6.5 },
      { type: 'sat', min_math: 600, min_verbal: 600 },
      { type: 'duolingo' },
    ];
    expect(summarizeTests(tests, keyOrFallback)).toEqual([
      'test_abbr_toefl 80',
      'test_abbr_ielts 6.5',
      'test_abbr_sat 1200',
      'test_abbr_duolingo',
    ]);
  });

  it('labels other exams and leaves non-tests out', () => {
    const tests: TestEntry[] = [
      { type: 'pte', min_score: 59 },
      { type: 'other', min_score: 56, note: 'Michigan English Test 56' },
      { type: 'personal_statement' },
      { type: 'gmat', min_score: 600 },
    ];
    expect(summarizeTests(tests, keyOrFallback)).toEqual(['test_abbr_pte 59', 'GMAT 600']);
  });

  it('shows an exact repeat once', () => {
    const tests: TestEntry[] = [
      { type: 'ielts', min_score: 6.5, note: 'track A' },
      { type: 'ielts', min_score: 6.5, note: 'track B' },
      { type: 'ielts', min_score: 7 },
    ];
    expect(summarizeTests(tests, keyOrFallback)).toEqual(['test_abbr_ielts 6.5', 'test_abbr_ielts 7']);
  });

  it('returns nothing when every entry is a non-test', () => {
    expect(summarizeTests([{ type: 'other' }, { type: 'supplemental' }], keyOrFallback)).toEqual([]);
  });
});

describe('test label i18n keys', () => {
  const locales = ['en', 'ru', 'tk'] as const;
  const messages = Object.fromEntries(
    locales.map((l) => [
      l,
      JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../messages/${l}.json`), 'utf-8')) as {
        university: Record<string, string>;
      },
    ]),
  );
  // Keys EntranceRequirements uses directly besides the label map.
  const extraKeys = ['min_score_only_suffix', 'min_score_suffix', 'tests_title', 'test_summary_label'];

  for (const locale of locales) {
    it(`every referenced key exists and is non-empty in ${locale}.json`, () => {
      for (const key of [...Object.values(TEST_LABEL_KEYS), ...extraKeys]) {
        const value = messages[locale].university[key];
        expect(typeof value === 'string' && value.trim().length > 0, `${locale}: university.${key}`).toBe(true);
      }
    });
  }
});
