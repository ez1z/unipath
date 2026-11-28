/**
 * Theme (Profile › Theme) is a setting of the device: a `clavis_theme` cookie,
 * `light` or `dark`; no cookie follows the system setting.
 *
 * Cached pages are the same for everyone, so a tiny inline script in <head>
 * applies the cookie before first paint. It is fixed text, so the CSP (M8)
 * allows it by hash. Pages rendered per request also set it on the server,
 * which works with JavaScript off.
 */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'clavis_theme';

/**
 * Inside the Telegram Mini App, "system" means Telegram's light or dark,
 * which lib/telegram-app.ts keeps in sessionStorage (`clavis_tg_scheme`).
 * A theme chosen in Profile still wins.
 */
export const THEME_SCRIPT =
  "try{var m=document.cookie.match(/(?:^|; )clavis_theme=(light|dark)(?:;|$)/),s=m?m[1]:sessionStorage.getItem('clavis_tg_scheme');if(s==='light'||s==='dark')document.documentElement.setAttribute('data-theme',s)}catch(e){}";

export function themeFromCookie(value: string | undefined): 'light' | 'dark' | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}
