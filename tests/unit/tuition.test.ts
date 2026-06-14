import { describe, it, expect } from 'vitest';
import { parseTuitionOptionsJson, parseTuitionOptionsCsv } from '@/lib/types/tuition';

describe('parseTuitionOptionsJson', () => {
  it('returns [] for non-array input', () => {
    expect(parseTuitionOptionsJson(null)).toEqual([]);
    expect(parseTuitionOptionsJson('nope')).toEqual([]);
    expect(parseTuitionOptionsJson({})).toEqual([]);
  });

  it('parses a well-formed option and normalises empty dimensions to null', () => {
    const result = parseTuitionOptionsJson([
      { semester: 'Fall', language: '', major: 'Engineering', amount_usd: 5000, note: '  ' },
    ]);
    expect(result).toEqual([
      { semester: 'Fall', language: null, major: 'Engineering', amount_usd: 5000, note: null },
    ]);
  });

  it('coerces string amounts and drops invalid/negative amounts', () => {
    const result = parseTuitionOptionsJson([
      { amount_usd: '1200' },
      { amount_usd: -5 },
      { amount_usd: 'abc' },
      { amount_usd: 0 },
    ]);
    expect(result).toEqual([
      { semester: null, language: null, major: null, amount_usd: 1200, note: null },
      { semester: null, language: null, major: null, amount_usd: 0, note: null },
    ]);
  });

  it('skips non-object entries', () => {
    expect(parseTuitionOptionsJson(['x', 5, null, { amount_usd: 100 }])).toHaveLength(1);
  });
});

describe('parseTuitionOptionsCsv', () => {
  it('returns [] for blank input', () => {
    expect(parseTuitionOptionsCsv('')).toEqual([]);
    expect(parseTuitionOptionsCsv('   ')).toEqual([]);
  });

  it('parses pipe-separated records with colon-separated fields', () => {
    const result = parseTuitionOptionsCsv('Fall:English:Engineering:5000:scholarship|::Medicine:8000');
    expect(result).toEqual([
      { semester: 'Fall', language: 'English', major: 'Engineering', amount_usd: 5000, note: 'scholarship' },
      { semester: null, language: null, major: 'Medicine', amount_usd: 8000, note: null },
    ]);
  });

  it('drops records with an invalid amount', () => {
    expect(parseTuitionOptionsCsv('Fall:English:Engineering:notanumber')).toEqual([]);
  });
});
