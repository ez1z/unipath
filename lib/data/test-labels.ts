import type { TestEntry } from '@/lib/data/fit';

/**
 * Display helpers for the entries in an `entrance_requirements.tests` /
 * `requirements.tests` array.
 *
 * The array is written by the daily import job, so `type` is free text: besides
 * the four tests the fit calculation scores (toefl/ielts/sat/duolingo) it holds
 * dozens of other exams, spelling variants ("pte" / "pte_academic",
 * "cambridge c2 proficiency") and the odd entry that is not a test at all
 * ("other" with the real names in its note). This module turns one raw entry
 * into something a component can render without ever showing a raw i18n key.
 *
 * Display only — it never feeds the fit calculation, which keeps matching the
 * raw `type` exactly.
 */

/** Tests whose current rendering (labels, max-score suffixes) is fixed. */
export const CORE_TEST_KEYS = ['toefl', 'ielts', 'sat', 'duolingo'] as const;
export type CoreTestKey = (typeof CORE_TEST_KEYS)[number];

/**
 * Known normalized keys → i18n key in the `university` namespace.
 * Every value here must exist in messages/{en,ru,tk}.json (enforced by a unit test).
 */
export const TEST_LABEL_KEYS: Record<string, string> = {
  toefl: 'test_abbr_toefl',
  ielts: 'test_abbr_ielts',
  sat: 'test_abbr_sat',
  duolingo: 'test_abbr_duolingo',
  pte: 'test_abbr_pte',
  act: 'test_abbr_act',
  toeic: 'test_abbr_toeic',
  toefl_essentials: 'test_abbr_toefl_essentials',
  cambridge: 'test_abbr_cambridge',
  languagecert: 'test_abbr_languagecert',
  testdaf: 'test_abbr_testdaf',
  teps: 'test_abbr_teps',
  teps_new: 'test_abbr_teps_new',
  hsk: 'test_abbr_hsk',
  dele_siele: 'test_abbr_dele_siele',
  tr_yos: 'test_abbr_tr_yos',
  institutional_yos: 'test_abbr_institutional_yos',
  ib: 'test_abbr_ib',
  a_level: 'test_abbr_a_level',
  english: 'test_abbr_english',
  russian_language_exam: 'test_abbr_russian_language_exam',
  // Not tests — kept out of the "Min. test scores" summary.
  other: 'requirement_other',
  personal_statement: 'essay_type_personal_statement',
  supplemental: 'essay_type_supplemental',
  letter_of_motivation: 'essay_type_letter_of_motivation',
  womens_college: 'requirement_womens_college',
};

/** Spelling variants seen in the data → the key they share a label with. */
const ALIASES: Record<string, string> = {
  pte_academic: 'pte',
  cambridge_cae_cpe: 'cambridge',
  english_proficiency: 'english',
  spanish_dele_siele: 'dele_siele',
};

/**
 * Entries that are not a scored exam: "other" only says "see the note", the
 * rest are essays / institution facts that occasionally land in the array.
 */
const NON_TEST_KEYS = new Set([
  'other',
  'personal_statement',
  'supplemental',
  'letter_of_motivation',
  'womens_college',
]);

/** Lowercase, collapse anything that is not a letter or digit to `_`. */
function slug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

/** Map a raw `type` string to the key its label is stored under. */
export function normalizeTestType(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = slug(raw);
  if (ALIASES[s]) return ALIASES[s];
  // "cambridge c2 proficiency", "cambridge_c1_advanced", … — one exam family.
  if (s.startsWith('cambridge_')) return 'cambridge';
  return s;
}

/**
 * Readable text for a type nobody has labelled yet: "gre" → "GRE",
 * "michigan_english_test" → "Michigan english test". Strings that already
 * carry capitals ("DSH-2") are left as written apart from underscores.
 */
export function humanizeTestType(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text !== text.toLowerCase()) return text;
  if (!text.includes(' ') && text.length <= 5) return text.toUpperCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function numberOrText(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

/**
 * The minimum as the data states it, or null. SAT keeps its existing
 * math + verbal total and falls back to a single `min_score` (the shape most
 * imported SAT rows use, and the one the fit calculation already reads).
 * `min_level` ("B1") covers exams graded by CEFR level instead of a score.
 */
export function testScoreText(test: TestEntry): string | null {
  if (normalizeTestType(test.type) === 'sat') {
    const total = (test.min_math ?? 0) + (test.min_verbal ?? 0);
    if (total > 0) return String(total);
  }
  return numberOrText(test.min_score) ?? numberOrText(test.min_level);
}

export type TestLabel = {
  /** Normalized key, e.g. 'pte' for both "pte" and "pte_academic". */
  key: string;
  /** i18n key in the `university` namespace, or null → render `fallback`. */
  labelKey: string | null;
  /** Humanized raw type, for types without a label key. */
  fallback: string;
  /** Minimum as given in the data, or null. */
  score: string | null;
  /** False for entries that are not a scored exam — hidden from the summary. */
  isTest: boolean;
  /** One of the four tests with fixed rendering. */
  isCore: boolean;
  /** Free-text note from the data, if any. */
  note: string | null;
};

export function describeTest(test: TestEntry): TestLabel {
  // An entry with no usable type is at best "see the note".
  const key = normalizeTestType(test.type) || 'other';
  return {
    key,
    labelKey: TEST_LABEL_KEYS[key] ?? null,
    fallback: humanizeTestType(test.type) || key,
    score: testScoreText(test),
    isTest: !NON_TEST_KEYS.has(key),
    isCore: (CORE_TEST_KEYS as readonly string[]).includes(key),
    note: typeof test.note === 'string' && test.note.trim() ? test.note.trim() : null,
  };
}

/** True when an entry says nothing a reader could use (no name, score or note). */
export function isEmptyTestEntry(d: TestLabel): boolean {
  return d.key === 'other' && d.score == null && d.note == null;
}

/**
 * The "Min. test scores" line: one "LABEL SCORE" string per scored exam, in
 * data order. Non-test entries are dropped, and exact repeats (the data lists
 * some tests once per track) are shown once. `label` resolves the display name
 * — normally the translation of `labelKey`, else `fallback`.
 */
export function summarizeTests(tests: TestEntry[], label: (d: TestLabel) => string): string[] {
  const out: string[] = [];
  for (const test of tests) {
    const d = describeTest(test);
    if (!d.isTest) continue;
    const name = label(d);
    const text = d.score ? `${name} ${d.score}` : name;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

/** Resolve a TestLabel's display name with a `university`-namespace translator. */
export function testLabelText(d: TestLabel, t: (key: string) => string): string {
  return d.labelKey ? t(d.labelKey) : d.fallback;
}
