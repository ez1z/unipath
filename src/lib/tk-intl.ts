/**
 * Turkmen formatting without Intl. The Workers runtime ships no Turkmen locale
 * data, so `Intl.*('tk')` quietly falls back to English ("Jan 27, 2027",
 * "$6,000", "English"). These follow the CLDR Turkmen patterns instead, and are
 * used for `tk` everywhere, so tests in Node and pages in workerd agree.
 */

const NBSP = String.fromCharCode(0xa0);

const MONTHS_SHORT = [
  'ýan',
  'few',
  'mar',
  'apr',
  'maý',
  'iýun',
  'iýul',
  'awg',
  'sen',
  'okt',
  'noý',
  'dek',
];
const MONTHS_LONG = [
  'Ýanwar',
  'Fewral',
  'Mart',
  'Aprel',
  'Maý',
  'Iýun',
  'Iýul',
  'Awgust',
  'Sentýabr',
  'Oktýabr',
  'Noýabr',
  'Dekabr',
];

/** Teaching languages by ISO 639-1 code (CLDR Turkmen names). */
const LANGUAGES: Record<string, string> = {
  ar: 'arap dili',
  cs: 'çeh dili',
  de: 'nemes dili',
  en: 'iňlis dili',
  es: 'ispan dili',
  fr: 'fransuz dili',
  hu: 'wenger dili',
  it: 'italýan dili',
  ja: 'ýapon dili',
  kk: 'gazak dili',
  ko: 'koreý dili',
  ky: 'gyrgyz dili',
  ms: 'malaý dili',
  nl: 'niderland dili',
  pl: 'polýak dili',
  pt: 'portugal dili',
  ro: 'rumyn dili',
  ru: 'rus dili',
  tk: 'türkmen dili',
  tr: 'türk dili',
  uk: 'ukrain dili',
  uz: 'özbek dili',
  zh: 'hytaý dili',
};

/** "12 000", "3,5": spaces between thousands, a decimal comma. */
export function tkNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits, useGrouping: true })
    .format(value)
    .replaceAll(',', NBSP)
    .replace('.', ',');
}

export function tkCurrency(value: number, currency: 'USD' | 'TMT'): string {
  return `${tkNumber(value, 0)}${NBSP}${currency === 'USD' ? 'US$' : 'TMT'}`;
}

/** "27 ýan 2027" for `YYYY-MM-DD`. */
export function tkDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS_SHORT[(month ?? 1) - 1]} ${year}`;
}

export function tkMonth(month: number): string {
  return MONTHS_LONG[month - 1] ?? String(month);
}

export function tkLanguage(code: string): string | null {
  return LANGUAGES[code.toLowerCase()] ?? null;
}

/** "a, b we c". */
export function tkList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} we ${items.at(-1)}`;
}
