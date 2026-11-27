import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import ru from '../../src/i18n/ru.json';
import tk from '../../src/i18n/tk.json';
import {
  DEFAULT_LANG,
  LANGS,
  formatMessage,
  getTranslations,
  isLang,
  localizePath,
  resolveLang,
  splitLangPath,
} from '../../src/i18n';

const files: Record<string, Record<string, string>> = { tk, ru, en };

describe('message files', () => {
  const allKeys = new Set(Object.values(files).flatMap((file) => Object.keys(file)));

  for (const [lang, file] of Object.entries(files)) {
    it(`${lang}.json has every key`, () => {
      const missing = [...allKeys].filter((key) => !(key in file));
      expect(missing).toEqual([]);
    });

    it(`${lang}.json has no empty strings`, () => {
      const empty = Object.entries(file)
        .filter(([, text]) => typeof text !== 'string' || text.trim() === '')
        .map(([key]) => key);
      expect(empty).toEqual([]);
    });
  }
});

describe('language helpers', () => {
  it('has Turkmen, Russian and English, Turkmen first and default', () => {
    expect(LANGS).toEqual(['tk', 'ru', 'en']);
    expect(DEFAULT_LANG).toBe('tk');
  });

  it('recognises only supported languages', () => {
    expect(isLang('ru')).toBe(true);
    expect(isLang('tm')).toBe(false);
    expect(isLang('')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });

  it('falls back to Turkmen when nothing valid is saved', () => {
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang(undefined)).toBe('tk');
    expect(resolveLang('de')).toBe('tk');
  });

  it('splits the language prefix off a path', () => {
    expect(splitLangPath('/ru/search')).toEqual({ lang: 'ru', rest: '/search' });
    expect(splitLangPath('/en')).toEqual({ lang: 'en', rest: '' });
    expect(splitLangPath('/en/')).toEqual({ lang: 'en', rest: '' });
    expect(splitLangPath('/entry')).toEqual({ lang: null, rest: '/entry' });
    expect(splitLangPath('/de/search')).toEqual({ lang: null, rest: '/de/search' });
  });

  it('builds the same page in another language', () => {
    expect(localizePath('/ru/universities/demo-1', 'tk')).toBe('/tk/universities/demo-1');
    expect(localizePath('/en', 'ru')).toBe('/ru');
    expect(localizePath('/', 'en')).toBe('/en');
  });

  it('translates through the page language', () => {
    expect(getTranslations('en')('nav.home')).toBe('Home');
    expect(getTranslations('ru')('nav.home')).toBe(ru['nav.home']);
  });
});

describe('formatMessage', () => {
  const years = '{n, plural, one {# год} few {# года} many {# лет} other {# года}}';

  it('picks the Russian plural form, decimals included', () => {
    expect(formatMessage('ru', years, { n: 1 })).toBe('1 год');
    expect(formatMessage('ru', years, { n: 3 })).toBe('3 года');
    expect(formatMessage('ru', years, { n: 5 })).toBe('5 лет');
    expect(formatMessage('ru', years, { n: 21 })).toBe('21 год');
    expect(formatMessage('ru', years, { n: 4.5 })).toBe('4,5 года');
  });

  it('formats numbers for the page language and fills placeholders', () => {
    expect(
      formatMessage('en', '{n, plural, one {# year} other {# years}} at {name}', {
        n: 4.5,
        name: 'Demo',
      }),
    ).toBe('4.5 years at Demo');
    expect(formatMessage('en', 'Rank {position}', { position: 1200 })).toBe('Rank 1,200');
  });

  it('falls back to "other", and leaves unknown placeholders as they are', () => {
    expect(formatMessage('tk', '{n, plural, other {# ýyl}}', { n: 1 })).toBe('1 ýyl');
    expect(formatMessage('en', 'Compare ({n})', {})).toBe('Compare ({n})');
  });

  it('getTranslations fills the real messages', () => {
    expect(getTranslations('ru')('search.count.programs', { n: 5 })).toBe('5 программ');
    expect(getTranslations('en')('search.count.programs', { n: 1 })).toBe('1 program');
    expect(getTranslations('tk')('path.total', { n: 5 })).toBe('jemi 5 ýyl');
  });
});

describe('placeholders', () => {
  /** `{name}` placeholders and plural arguments a message uses, e.g. ["n", "name"]. */
  const params = (text: string) =>
    [...new Set([...text.matchAll(/\{(\w+)(?:, plural,|\})/g)].map((m) => m[1] ?? ''))].sort();

  it('every language uses the same placeholders for each key', () => {
    const mismatched = Object.keys(en).filter((key) => {
      const expected = params((en as Record<string, string>)[key] ?? '');
      return ['tk', 'ru'].some(
        (lang) => params(files[lang]?.[key] ?? '').join() !== expected.join(),
      );
    });
    expect(mismatched).toEqual([]);
  });

  it('every plural message has an "other" form in every language', () => {
    const missing = Object.entries(files).flatMap(([lang, file]) =>
      Object.entries(file)
        .filter(([, text]) => text.includes(', plural,') && !/\bother\s*\{/.test(text))
        .map(([key]) => `${lang}:${key}`),
    );
    expect(missing).toEqual([]);
  });
});
