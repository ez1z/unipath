import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { voteHelpful } from '../../../lib/discussions';
import { getDb } from '../../../lib/server';

export const prerender = false;

const bodySchema = z.object({
  replyId: z.coerce.number().int().positive().max(2_147_483_647),
  on: z.union([z.boolean(), z.enum(['1', '0']).transform((v) => v === '1')]),
});

/** "Helpful" on a reply: one vote per user, not on one's own replies. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = bodySchema.safeParse(req.input);
  if (!input.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const result = await voteHelpful(
    getDb(),
    gate.signedIn.user.id,
    input.data.replyId,
    input.data.on,
  );
  if (result.ok) return reply(req, { ok: true, body: { count: result.count } });
  return reply(req, {
    ok: false,
    error: result.error,
    status: result.error === 'own' ? 403 : 404,
  });
};
