/**
 * Links into and out of sign-in. `next` is where the student was; `action` is
 * what they tried (e.g. `save:program:101`), finished right after sign-in.
 */
import type { Lang } from '../../i18n/config.ts';

export interface ReturnTo {
  next?: string | null | undefined;
  action?: string | null | undefined;
}

function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const s = query.toString();
  return s ? `${path}?${s}` : path;
}

export const signInPath = (lang: Lang, to: ReturnTo = {}, extra: Record<string, string> = {}) =>
  withQuery(`/${lang}/sign-in`, { next: to.next, action: to.action, ...extra });

/** After any sign-in method: create the profile, finish the action, go back. */
export const continuePath = (lang: Lang, to: ReturnTo = {}) =>
  withQuery(`/${lang}/auth/continue`, { next: to.next, action: to.action });

export const telegramPath = (lang: Lang, to: ReturnTo = {}) =>
  withQuery(`/${lang}/sign-in/telegram`, { next: to.next, action: to.action });

export const googlePath = (lang: Lang) => `/${lang}/sign-in/google`;

export const myPath = (lang: Lang, tab: '' | 'saved' | 'profile' = '') =>
  tab ? `/${lang}/my/${tab}` : `/${lang}/my`;
