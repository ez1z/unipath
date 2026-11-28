import type { APIRoute } from 'astro';
import { resolveLang } from '../../../i18n/config';
import { similarThreads, TITLE_MAX } from '../../../lib/discussions';
import { threadPath } from '../../../lib/discussions-view';
import { getDb } from '../../../lib/server';

export const prerender = false;

/**
 * `GET /api/discussions/similar?q=…&lang=tk`: up to five open questions with
 * words like the title being typed (FTS5 over thread titles). Public data.
 */
export const GET: APIRoute = async ({ url }) => {
  const lang = resolveLang(url.searchParams.get('lang'));
  const q = (url.searchParams.get('q') ?? '').slice(0, TITLE_MAX);
  const items = q.trim().length < 3 ? [] : await similarThreads(getDb(), lang, q);
  return Response.json(
    {
      items: items.map((item) => ({
        title: item.title,
        lang: item.lang,
        answered: item.answered,
        replies: item.replyCount,
        href: threadPath(lang, item.topic, item.id),
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
};
