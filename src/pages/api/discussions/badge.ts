import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { badgeRequestSchema, requestBadge, withdrawBadgeRequest } from '../../../lib/discussions';
import { getDb } from '../../../lib/server';

export const prerender = false;

const bodySchema = z.discriminatedUnion('action', [
  badgeRequestSchema.extend({ action: z.literal('request') }),
  z.object({
    action: z.literal('withdraw'),
    id: z.coerce.number().int().positive().max(2_147_483_647),
  }),
]);

/** Ask for a "Studies here" badge (an admin checks it, M7), or withdraw the request. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = bodySchema.safeParse(req.input);
  if (!input.success) return reply(req, { ok: false, error: 'badgeInvalid', status: 400 });

  const db = getDb();
  const userId = gate.signedIn.user.id;
  if (input.data.action === 'withdraw') {
    const done = await withdrawBadgeRequest(db, userId, input.data.id);
    return done
      ? reply(req, { ok: true })
      : reply(req, { ok: false, error: 'notFound', status: 404 });
  }
  const result = await requestBadge(db, userId, input.data);
  if (result === 'ok') {
    const url = new URL(req.back, 'http://x');
    url.searchParams.set('badge', 'requested');
    return reply(req, { ok: true, to: `${url.pathname}${url.search}#badge` });
  }
  return reply(req, {
    ok: false,
    error: result === 'exists' ? 'badgeExists' : result === 'limit' ? 'badgeLimit' : 'notFound',
    status: result === 'notFound' ? 404 : 409,
  });
};
