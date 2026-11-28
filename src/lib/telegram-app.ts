/**
 * Clavis inside Telegram (the Mini App). Runs in the browser on every page
 * and does nothing outside Telegram.
 *
 * This is a small bridge of our own instead of Telegram's telegram-web-app.js,
 * so the site loads no third-party script (CLAUDE.md). It speaks the same
 * documented protocol (https://core.telegram.org/api/web-events):
 *
 * - Page → Telegram: `TelegramWebviewProxy.postEvent` in the apps,
 *   `external.notify` in old Windows clients, `postMessage` to the parent
 *   frame in Telegram Web.
 * - Telegram → page: `window.Telegram.WebView.receiveEvent`, or a message
 *   from the parent frame.
 *
 * Telegram puts the launch data in the URL hash (`#tgWebAppData=…`) of the
 * first page only, so it is kept in sessionStorage for the rest of the visit.
 */
import { DEFAULT_LANG, splitLangPath } from '../i18n/config.ts';
import { THEME_COOKIE } from './theme.ts';

/** sessionStorage: the launch data of this visit. */
const LAUNCH_KEY = 'clavis_tg';
/** sessionStorage: Telegram's light/dark, read by THEME_SCRIPT before first paint. */
export const TG_SCHEME_KEY = 'clavis_tg_scheme';
/** Telegram Web runs Mini Apps in a frame on this origin. */
const TELEGRAM_WEB_ORIGIN = 'https://web.telegram.org';

export type ThemeParams = Record<string, string>;

export interface LaunchData {
  /** Signed by Telegram; the server checks it (lib/auth/telegram.ts). */
  initData: string;
  /** The Bot API version the Telegram app supports, e.g. "8.0". */
  version: string;
  platform: string;
  themeParams: ThemeParams | null;
}

function themeParamsOf(value: unknown): ThemeParams | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: ThemeParams = {};
  for (const [key, colour] of Object.entries(value)) {
    if (typeof colour === 'string') out[key] = colour;
  }
  return out;
}

/** Reads Telegram's launch parameters from a URL hash; null outside Telegram. */
export function parseLaunchHash(hash: string): LaunchData | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const initData = params.get('tgWebAppData');
  if (!initData) return null;
  let themeParams: ThemeParams | null;
  try {
    themeParams = themeParamsOf(JSON.parse(params.get('tgWebAppThemeParams') ?? 'null'));
  } catch {
    themeParams = null;
  }
  return {
    initData,
    version: params.get('tgWebAppVersion') ?? '6.0',
    platform: params.get('tgWebAppPlatform') ?? 'unknown',
    themeParams,
  };
}

/** True when the Telegram app supports at least this Bot API version. */
export function versionAtLeast(have: string, want: string): boolean {
  const a = have.split('.').map(Number);
  const b = want.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x) || x < y) return false;
    if (x > y) return true;
  }
  return true;
}

/** Telegram's own rule: dark when the background's perceived brightness is under 120. */
export function schemeOf(theme: ThemeParams | null): 'light' | 'dark' | null {
  const bg = theme?.['bg_color']?.trim().toLowerCase() ?? '';
  let rgb: number[] | null = null;
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(bg);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(bg);
  if (long) rgb = long.slice(1).map((h) => parseInt(h, 16));
  else if (short) rgb = short.slice(1).map((h) => parseInt(h + h, 16));
  if (!rgb) return null;
  const [r = 0, g = 0, b = 0] = rgb;
  const hsp = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
  return hsp < 120 ? 'dark' : 'light';
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Private mode or full storage: the Mini App still works on this page.
  }
}

let launch: LaunchData | null | undefined;

/** The platform name scripts/dev-telegram-webapp.ts uses; honoured on localhost only. */
export const DEV_PLATFORM = 'dev';

/**
 * Is this page really running inside a Telegram client? Launch data in a
 * hash alone proves nothing: anyone can send a link like
 * `/tg#tgWebAppData=<their own signed data>`, and signing a visitor into
 * someone else's account that way is a login CSRF. So the hash is only taken
 * when Telegram's bridge is there: the apps inject `TelegramWebviewProxy`, old
 * Windows clients `external.notify`, and Telegram Web frames the page from
 * web.telegram.org (M8's CSP allows no other frame parent).
 */
export function telegramClientPresent(platform: string): boolean {
  const w = window as TelegramWindow;
  if (w.TelegramWebviewProxy) return true;
  const external = (w as unknown as { external?: { notify?: unknown } }).external;
  if (external && typeof external.notify === 'function') return true;
  if (w.parent !== w) {
    let parentOrigin = location.ancestorOrigins?.[0];
    if (parentOrigin === undefined) {
      try {
        parentOrigin = document.referrer ? new URL(document.referrer).origin : undefined;
      } catch {
        parentOrigin = undefined;
      }
    }
    if (parentOrigin === TELEGRAM_WEB_ORIGIN) return true;
  }
  // The local stand-in, in a plain browser.
  return platform === DEV_PLATFORM && ['localhost', '127.0.0.1'].includes(location.hostname);
}

/**
 * This visit's launch data. Telegram opens the Mini App at `/tg` with the data
 * in the hash; it is taken there (inside a real Telegram client only) and kept
 * in sessionStorage for the rest of the visit.
 */
export function launchData(): LaunchData | null {
  if (launch !== undefined) return launch;
  const fromHash = location.pathname === '/tg' ? parseLaunchHash(location.hash) : null;
  if (fromHash && telegramClientPresent(fromHash.platform)) {
    save(LAUNCH_KEY, JSON.stringify(fromHash));
    launch = fromHash;
    return launch;
  }
  try {
    const stored = JSON.parse(
      storage()?.getItem(LAUNCH_KEY) ?? 'null',
    ) as Partial<LaunchData> | null;
    launch =
      stored && typeof stored.initData === 'string' && stored.initData
        ? {
            initData: stored.initData,
            version: typeof stored.version === 'string' ? stored.version : '6.0',
            platform: typeof stored.platform === 'string' ? stored.platform : 'unknown',
            themeParams: themeParamsOf(stored.themeParams),
          }
        : null;
  } catch {
    launch = null;
  }
  return launch;
}

export function inTelegramApp(): boolean {
  return launchData() !== null;
}

const supports = (version: string) => versionAtLeast(launchData()?.version ?? '6.0', version);

type TelegramWindow = Window & {
  TelegramWebviewProxy?: { postEvent(eventType: string, eventData: string): void };
  Telegram?: { WebView?: { receiveEvent?: (eventType: string, eventData: unknown) => void } };
};

/** Sends an event to the Telegram app. Fails quietly: the page works without it. */
export function postEvent(eventType: string, eventData: unknown = ''): void {
  const w = window as TelegramWindow;
  const external = (w as unknown as { external?: { notify?: (message: string) => void } }).external;
  try {
    if (w.TelegramWebviewProxy) {
      w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    } else if (external && typeof external.notify === 'function') {
      external.notify(JSON.stringify({ eventType, eventData }));
    } else if (w.parent !== w) {
      w.parent.postMessage(JSON.stringify({ eventType, eventData }), TELEGRAM_WEB_ORIGIN);
    }
  } catch {
    // Not inside a Telegram client after all.
  }
}

type Handler = (eventData: unknown) => void;
const handlers = new Map<string, Handler[]>();

function receiveEvent(eventType: string, eventData: unknown) {
  for (const handler of handlers.get(eventType) ?? []) handler(eventData);
}

function onEvent(eventType: string, handler: Handler) {
  handlers.set(eventType, [...(handlers.get(eventType) ?? []), handler]);
}

let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  const w = window as TelegramWindow;
  w.Telegram = { ...w.Telegram, WebView: { ...w.Telegram?.WebView, receiveEvent } };
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== TELEGRAM_WEB_ORIGIN) return;
    try {
      const message = JSON.parse(String(event.data)) as {
        eventType?: unknown;
        eventData?: unknown;
      };
      if (typeof message.eventType === 'string') receiveEvent(message.eventType, message.eventData);
    } catch {
      // Not a Telegram message.
    }
  });
}

/**
 * Opens a t.me link inside Telegram without closing the Mini App. Returns
 * false outside Telegram or for any other address.
 */
export function openTelegramLink(href: string): boolean {
  if (!inTelegramApp()) return false;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 't.me') return false;
  if (supports('6.1') || window.parent !== window) {
    postEvent('web_app_open_tg_link', { path_full: url.pathname + url.search });
  } else {
    location.href = url.href;
  }
  return true;
}

/** Telegram's share sheet for a link and a short message. */
export function shareInTelegram(link: string, text: string): boolean {
  return openTelegramLink(
    `https://t.me/share/url?${new URLSearchParams({ url: link, text }).toString()}`,
  );
}

// ---------------------------------------------------------------------------
// Theme: follow Telegram's light/dark unless the student chose one in Profile
// ---------------------------------------------------------------------------

function hasThemeCookie(): boolean {
  return new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`).test(document.cookie);
}

/** Paints Telegram's header and background in Clavis's own surface colour (from tokens.css). */
function paintChrome() {
  const colour = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return;
  if (supports('6.1')) postEvent('web_app_set_background_color', { color: colour });
  if (supports('6.9')) postEvent('web_app_set_header_color', { color: colour });
  else if (supports('6.1')) postEvent('web_app_set_header_color', { color_key: 'bg_color' });
  if (supports('7.10')) postEvent('web_app_set_bottom_bar_color', { color: colour });
}

function applyTheme(theme: ThemeParams | null) {
  const scheme = schemeOf(theme);
  if (scheme) {
    save(TG_SCHEME_KEY, scheme);
    if (!hasThemeCookie()) document.documentElement.setAttribute('data-theme', scheme);
  }
  paintChrome();
}

// ---------------------------------------------------------------------------
// Back button: shown everywhere but Home; goes back, or Home if there is no page to go back to
// ---------------------------------------------------------------------------

function homePath(): string {
  return `/${splitLangPath(location.pathname).lang ?? DEFAULT_LANG}`;
}

function setUpBackButton() {
  if (!supports('6.1')) return;
  const atHome = splitLangPath(location.pathname).rest === '';
  postEvent('web_app_setup_back_button', { is_visible: !atHome });
}

function goBack() {
  // The first page after /tg has /tg (or nothing) behind it: going there would sign in again.
  let previous: URL | null;
  try {
    previous = document.referrer ? new URL(document.referrer) : null;
  } catch {
    previous = null;
  }
  if (previous && previous.origin === location.origin && previous.pathname !== '/tg') {
    history.back();
  } else {
    location.href = homePath();
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const SIGN_IN_TELEGRAM = /^\/(tk|ru|en)\/sign-in\/telegram$/;

let started = false;

/** Called once per page by components/TelegramApp.astro. */
export function startTelegramApp(): void {
  const data = launchData();
  if (!data || started) return;
  started = true;
  listen();

  postEvent('web_app_ready');
  postEvent('web_app_expand');
  applyTheme(data.themeParams);
  postEvent('web_app_request_theme');
  setUpBackButton();

  onEvent('theme_changed', (eventData) => {
    const theme = themeParamsOf((eventData as { theme_params?: unknown } | null)?.theme_params);
    if (!theme) return;
    launch = { ...data, themeParams: theme };
    save(LAUNCH_KEY, JSON.stringify(launch));
    applyTheme(theme);
  });
  onEvent('back_button_pressed', goBack);

  // A page restored from the back/forward cache keeps this script's state but
  // not Telegram's: set the back button again.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) setUpBackButton();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    // Inside Telegram, "Continue with Telegram" is the silent sign-in, not the Login Widget.
    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && SIGN_IN_TELEGRAM.test(url.pathname)) {
        event.preventDefault();
        location.href = `/tg${url.search}`;
      }
    }
  });

  // Telegram reminders need the bot to be allowed to write to the student.
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (
      input instanceof HTMLInputElement &&
      input.name === 'reminderChannel' &&
      input.value === 'telegram' &&
      input.checked &&
      supports('6.9')
    ) {
      postEvent('web_app_request_write_access');
    }
  });
}
