/**
 * Language constants and pure helpers. Kept free of the message files so client
 * scripts can import it without shipping every translation to the browser.
 */

export const LANGS = ['tk', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Turkmen is the default for first visits. */
export const DEFAULT_LANG: Lang = 'tk';

/** Cookie that remembers the language a visitor chose with the language switch. */
export const LANG_COOKIE = 'clavis_lang';

/** Each language's name in its own language, for the language switch. */
export const LANG_NAMES: Record<Lang, string> = {
  tk: 'Türkmençe',
  ru: 'Русский',
  en: 'English',
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** The saved language if it is valid, else Turkmen. */
export function resolveLang(saved: string | undefined | null): Lang {
  return isLang(saved) ? saved : DEFAULT_LANG;
}

/**
 * Splits a pathname into its language prefix and the rest.
 * `/ru/search` -> { lang: 'ru', rest: '/search' }; `/about` -> { lang: null, rest: '/about' }.
 */
export function splitLangPath(pathname: string): { lang: Lang | null; rest: string } {
  const match = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (match && isLang(match[1])) {
    const rest = match[2] ?? '';
    return { lang: match[1], rest: rest === '/' ? '' : rest };
  }
  return { lang: null, rest: pathname === '/' ? '' : pathname };
}

/** The same page in another language: `/ru/search` -> `/tk/search`. */
export function localizePath(pathname: string, lang: Lang): string {
  return `/${lang}${splitLangPath(pathname).rest}`;
}
