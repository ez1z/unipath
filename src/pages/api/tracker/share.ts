import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { getDb } from '../../../lib/server';
import {
  createShareLink,
  revokeShareLink,
  shareCreateSchema,
  shareTokenSchema,
} from '../../../lib/tracker';

export const prerender = false;

const bodySchema = z.union([
  z.object({ action: z.literal('revoke'), token: shareTokenSchema }),
  z.object({ action: z.literal('create') }).and(shareCreateSchema),
]);

/** Create a read-only link for parents (90 days), or revoke one. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  // The parent's language is a separate field, so the form's own `lang` stays the page's.
  const input = { ...req.input, lang: req.input['shareLang'] ?? req.input['lang'] };
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const body = bodySchema.safeParse(input);
  if (!body.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const db = getDb();
  const userId = gate.signedIn.user.id;
  if (body.data.action === 'revoke') {
    const found = await revokeShareLink(db, userId, body.data.token);
    return found
      ? reply(req, { ok: true })
      : reply(req, { ok: false, error: 'notFound', status: 404 });
  }
  const result = await createShareLink(db, userId, body.data);
  if (!result.ok) {
    return reply(req, {
      ok: false,
      error: result.error,
      status: result.error === 'limit' ? 409 : 404,
    });
  }
  const url = new URL(req.back, 'http://x');
  url.searchParams.set('created', result.token);
  return reply(req, {
    ok: true,
    body: { token: result.token },
    to: `${url.pathname}${url.search}#share`,
  });
};
