// Splits plain text into text and URL segments so the renderer can gate links
// behind a trust warning. No HTML is produced — React escapes text segments.

export type Segment = { type: 'text'; value: string } | { type: 'url'; value: string };

// Matches http(s):// URLs and bare www. URLs. Trailing punctuation is trimmed below.
const URL_RE = /((?:https?:\/\/|www\.)[^\s]+)/gi;

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index!;
    let url = match[0];
    // Move trailing sentence punctuation back into the text segment.
    const trailing = url.match(/[.,!?)\]}'"]+$/);
    let tail = '';
    if (trailing) {
      tail = trailing[0];
      url = url.slice(0, url.length - tail.length);
    }
    if (start > last) segments.push({ type: 'text', value: text.slice(last, start) });
    segments.push({ type: 'url', value: url });
    if (tail) segments.push({ type: 'text', value: tail });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

// Normalise a bare www. URL to an absolute href.
export function toHref(url: string): string {
  return url.startsWith('www.') ? `https://${url}` : url;
}

export type MessageSegment =
  | Segment
  | { type: 'mention'; name: string; entityType: 'university' | 'scholarship'; slug: string };

// Mention token embedded in the body text: @[Display Name](u:slug) or @[Name](s:slug).
const MENTION_RE = /@\[([^\]]+)\]\((u|s):([a-z0-9-]+)\)/g;

export function buildMentionToken(
  entityType: 'university' | 'scholarship',
  slug: string,
  name: string,
): string {
  // Names can't contain ']' — strip to keep the token parseable.
  return `@[${name.replace(/[[\]]/g, '')}](${entityType === 'university' ? 'u' : 's'}:${slug})`;
}

// Parse mentions first, then linkify the remaining text runs for URLs.
export function parseMessage(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index!;
    if (start > last) out.push(...linkify(text.slice(last, start)));
    out.push({
      type: 'mention',
      name: m[1],
      entityType: m[2] === 'u' ? 'university' : 'scholarship',
      slug: m[3],
    });
    last = start + m[0].length;
  }
  if (last < text.length) out.push(...linkify(text.slice(last)));
  return out;
}
