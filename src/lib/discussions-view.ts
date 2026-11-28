/**
 * Showing posts: plain text split into paragraphs, lines and links. Nothing
 * here builds HTML; Astro escapes every piece, so a post can never inject
 * markup. Only http(s) links become links (rel="nofollow ugc" in PostBody).
 */
import type { Lang } from '../i18n/config.ts';
import type { Translate } from '../i18n/index.ts';
import { CLAVIS_TIME_ZONE, todayIn } from './dates.ts';
import { DAILY_REPLIES, DAILY_THREADS, MAX_BADGE_REQUESTS } from './discussions.ts';
import { formatDate } from './format.ts';

export type Segment = { text: string } | { href: string; text: string };

/** Characters that end a sentence rather than the link. */
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', ')', ']', "'", '"', '»', '”']);
const count = (text: string, char: string) => text.split(char).length - 1;

/** Drops sentence punctuation from the end; keeps a ")" that closes one in the URL. */
function trimUrl(raw: string): string {
  let url = raw;
  while (url.length > 0 && TRAILING.has(url.at(-1) ?? '')) {
    if (url.endsWith(')') && count(url, '(') >= count(url, ')')) break;
    url = url.slice(0, -1);
  }
  return url;
}
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;

/** A line's text and links. A link that doesn't parse as a URL stays text. */
export function linkSegments(line: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    const raw = trimUrl(match[0]);
    let href: string | null = null;
    try {
      const url = new URL(raw);
      if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href;
    } catch {
      href = null;
    }
    if (!href) continue;
    const start = match.index;
    if (start > last) out.push({ text: line.slice(last, start) });
    out.push({ href, text: raw });
    last = start + raw.length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

/** Paragraphs (blank line apart) of lines of segments. */
export function postParagraphs(body: string): Segment[][][] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split('\n').map(linkSegments))
    .filter((lines) => lines.some((line) => line.length > 0));
}

/** The calendar date of a post in Ashgabat, in the page language. */
export function postDate(lang: Lang, at: Date): string {
  return formatDate(lang, todayIn(CLAVIS_TIME_ZONE, at));
}

/** `YYYY-MM-DD` for a `<time datetime>`. */
export function postIsoDate(at: Date): string {
  return todayIn(CLAVIS_TIME_ZONE, at);
}

export function threadPath(lang: Lang, topic: string, id: number): string {
  return `/${lang}/discussions/${topic}/${id}`;
}

/** Words for an `?error=` code from /api/discussions/*. */
export function discussionError(t: Translate, code: string | null): string | null {
  switch (code) {
    case null:
    case '':
      return null;
    case 'daily':
      return t('discussions.error.daily', { threads: DAILY_THREADS, replies: DAILY_REPLIES });
    case 'rate':
      return t('discussions.error.rate');
    case 'invalid':
      return t('discussions.error.invalid');
    case 'tag':
      return t('discussions.error.tag');
    case 'closed':
      return t('discussions.error.closed');
    case 'own':
      return t('discussions.error.own');
    case 'badgeInvalid':
      return t('badge.error.invalid');
    case 'badgeExists':
      return t('badge.error.exists');
    case 'badgeLimit':
      return t('badge.error.limit', { n: MAX_BADGE_REQUESTS });
    default:
      return t('discussions.error.generic');
  }
}
