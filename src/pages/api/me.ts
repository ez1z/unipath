import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isLang, resolveLang } from '../../i18n/config';
import { ensureProfile, quizSchema, setQuiz } from '../../lib/account';
import { getSignedIn } from '../../lib/auth/server';
import { getDb } from '../../lib/server';

export const prerender = false;

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * `GET /api/me?lang=tk` → `{ signedIn: false }` or `{ signedIn: true, quiz }`.
 * Islands use it to copy the quick-question answers between the device and the
 * profile. No email or other personal data is returned.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const signedIn = await getSignedIn(request.headers);
  if (!signedIn) return Response.json({ signedIn: false }, { headers: NO_STORE });
  const lang = resolveLang(url.searchParams.get('lang'));
  const profile = await ensureProfile(getDb(), signedIn.user.id, lang);
  return Response.json({ signedIn: true, quiz: profile.quiz ?? null }, { headers: NO_STORE });
};

/** `PUT /api/me` with `{ quiz, lang }`: the answers on this device become the profile's. */
export const PUT: APIRoute = async ({ request }) => {
  const signedIn = await getSignedIn(request.headers);
  if (!signedIn) return Response.json({ error: 'auth' }, { status: 401, headers: NO_STORE });
  const limit = await env.WRITE_LIMITER.limit({ key: `write:${signedIn.user.id}` });
  if (!limit.success) return Response.json({ error: 'rate' }, { status: 429, headers: NO_STORE });

  let body: { quiz?: unknown; lang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'invalid' }, { status: 400, headers: NO_STORE });
  }
  const quiz = quizSchema.safeParse(body.quiz);
  if (!quiz.success) return Response.json({ error: 'invalid' }, { status: 400, headers: NO_STORE });
  const db = getDb();
  await ensureProfile(db, signedIn.user.id, isLang(body.lang) ? body.lang : resolveLang(null));
  await setQuiz(db, signedIn.user.id, quiz.data);
  return Response.json({ ok: true }, { headers: NO_STORE });
};
