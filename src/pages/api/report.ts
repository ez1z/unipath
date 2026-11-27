import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isLang } from '../../i18n';
import { submitReport } from '../../lib/report';
import { clientIp, getDb } from '../../lib/server';

export const prerender = false;

const STATUS = { invalid: 400, short: 400, long: 400, notFound: 404, rate: 429 } as const;

/**
 * JSON version of "Report a mistake" for islands:
 * POST { type, id, message, lang? } → 201 { ok: true } or 4xx { ok: false, error }.
 * Validated with Zod and rate-limited per IP, like the form page.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  }
  const langValue =
    typeof body === 'object' && body !== null ? (body as { lang?: unknown }).lang : undefined;
  const lang = isLang(langValue) ? langValue : 'en';
  const ip = clientIp(request);
  const result = await submitReport(body, {
    db: getDb(),
    lang,
    allow: async () => (await env.REPORT_LIMITER.limit({ key: `report:${ip}` })).success,
  });
  if (result.ok) return Response.json({ ok: true }, { status: 201 });
  return Response.json({ ok: false, error: result.error }, { status: STATUS[result.error] });
};
