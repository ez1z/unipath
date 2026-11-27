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

export type Translate = (key: MessageKey) => string;

/** Returns `t(key)` for a page language. */
export function getTranslations(lang: Lang): Translate {
  const table = messages[lang];
  return (key) => table[key];
}
