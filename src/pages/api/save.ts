import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import * as z from 'zod';
import { isLang, resolveLang } from '../../i18n/config';
import {
  ensureProfile,
  isSaved,
  savedItemSchema,
  serializePendingAction,
  setSaved,
} from '../../lib/account';
import { safeNextPath } from '../../lib/auth/next';
import { getSignedIn, redirectWithCookies } from '../../lib/auth/server';
import { signInPath } from '../../lib/auth/urls';
import { getDb } from '../../lib/server';

export const prerender = false;

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** `GET /api/save?type=program&id=101` → `{ signedIn, saved }`, for SaveButton. */
export const GET: APIRoute = async ({ request, url }) => {
  const item = savedItemSchema.safeParse({
    type: url.searchParams.get('type'),
    id: url.searchParams.get('id'),
  });
  if (!item.success) return json({ error: 'invalid' }, 400);
  const signedIn = await getSignedIn(request.headers);
  if (!signedIn) return json({ signedIn: false, saved: false });
  return json({ signedIn: true, saved: await isSaved(getDb(), signedIn.user.id, item.data) });
};

const bodySchema = savedItemSchema.extend({
  saved: z.union([z.boolean(), z.enum(['1', '0']).transform((v) => v === '1')]),
});

/**
 * Save or unsave. JSON from SaveButton → JSON (401 when signed out, so the
 * island opens the sign-in sheet). A plain form (no JavaScript) → a redirect:
 * back to the page, or to sign-in with the save as the pending action.
 */
export const POST: APIRoute = async ({ request }) => {
  const isForm = !(request.headers.get('Content-Type') ?? '').includes('application/json');
  let input: Record<string, unknown>;
  try {
    input = isForm
      ? Object.fromEntries(await request.formData())
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const lang = isLang(input['lang']) ? input['lang'] : resolveLang(null);
  const back = safeNextPath(input['back']) ?? `/${lang}`;
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success)
    return isForm ? redirectWithCookies(back, []) : json({ error: 'invalid' }, 400);
  const { type, id, saved } = parsed.data;

  const cookies = new Headers();
  const signedIn = await getSignedIn(request.headers, cookies);
  if (!signedIn) {
    if (!isForm) return json({ error: 'auth' }, 401);
    const action = saved ? serializePendingAction({ kind: 'save', item: { type, id } }) : null;
    return redirectWithCookies(signInPath(lang, { next: back, action }), []);
  }

  const limit = await env.WRITE_LIMITER.limit({ key: `write:${signedIn.user.id}` });
  if (!limit.success) {
    return isForm
      ? redirectWithCookies(back, cookies.getSetCookie())
      : json({ error: 'rate' }, 429);
  }

  const db = getDb();
  await ensureProfile(db, signedIn.user.id, lang);
  const result = await setSaved(db, signedIn.user.id, { type, id }, saved);
  if (isForm) return redirectWithCookies(back, cookies.getSetCookie());
  if (result === 'notFound') return json({ error: 'notFound' }, 404);
  const response = json({ ok: true, saved });
  for (const cookie of cookies.getSetCookie()) response.headers.append('Set-Cookie', cookie);
  return response;
};
