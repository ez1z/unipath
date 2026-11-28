import { tkNumber } from '../lib/tk-intl';
import type { Lang } from './config';
import en from './en.json';
import ru from './ru.json';
import tk from './tk.json';

export * from './config';

/** Keys come from en.json; tk.json and ru.json must have exactly the same keys (tested). */
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

// The annotation makes a key missing from tk.json or ru.json a type error as well.
export const messages: Record<Lang, Messages> = { tk, ru, en };

export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

/**
 * Fills a message. `{name}` is replaced by a parameter. One plural block per
 * parameter is allowed, ICU style, so every language keeps the same keys:
 * `{n, plural, one {# year} other {# years}}`. Russian also uses `few` and `many`.
 * `#` is the number formatted for the page language. Missing forms fall back to `other`.
 */
export function formatMessage(lang: Lang, message: string, params: MessageParams = {}): string {
  const number = (value: string | number) =>
    typeof value === 'number'
      ? lang === 'tk'
        ? tkNumber(value)
        : new Intl.NumberFormat(lang).format(value)
      : value;

  const withPlurals = message.replace(
    /\{(\w+), plural,((?:\s*\w+\s*\{[^{}]*\})+)\s*\}/g,
    (_, name: string, body: string) => {
      const value = params[name];
      if (value === undefined) return '';
      const forms = new Map<string, string>();
      for (const [, form, text] of body.matchAll(/(\w+)\s*\{([^{}]*)\}/g)) {
        if (form !== undefined && text !== undefined) forms.set(form, text);
      }
      // Turkmen has no plural forms for counted nouns ("5 ýyl"); workerd lacks its rules anyway.
      const rule = lang === 'tk' ? 'other' : new Intl.PluralRules(lang).select(Number(value));
      const chosen = forms.get(rule) ?? forms.get('other') ?? '';
      return chosen.replaceAll('#', number(value));
    },
  );
  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : number(value);
  });
}

/** Returns `t(key, params?)` for a page language. */
export function getTranslations(lang: Lang): Translate {
  const table = messages[lang];
  return (key, params) => {
    const message = table[key];
    return params || message.includes('{') ? formatMessage(lang, message, params) : message;
  };
}
