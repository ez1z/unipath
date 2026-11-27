import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import ru from '../../src/i18n/ru.json';
import tk from '../../src/i18n/tk.json';
import {
  DEFAULT_LANG,
  LANGS,
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
