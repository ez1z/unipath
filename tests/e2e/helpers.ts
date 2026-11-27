import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const LANGS = ['tk', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const messages = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    JSON.parse(
      readFileSync(new URL(`../../src/i18n/${lang}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
) as Record<Lang, Record<string, string>>;

/** A UI string from the message files; fails the test if the key is missing. */
export function msg(lang: Lang, key: string): string {
  const text = messages[lang][key];
  if (text === undefined) throw new Error(`Missing message ${lang}:${key}`);
  return text;
}

/** A message with `{name}` placeholders filled (no plurals: match those with a regex). */
export function fill(lang: Lang, key: string, params: Record<string, string | number>): string {
  return msg(lang, key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}

export const isPhone = (projectName: string) => projectName === 'phone';

/** The nav that is visible at this width: header nav on desktop, bottom bar on phone. */
export function mainNav(page: Page, projectName: string) {
  return page.locator(isPhone(projectName) ? '.bottom-bar' : '.header-nav');
}

export async function hasNoHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

/** Escapes text for use inside a RegExp. */
export function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}
