import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { setHelped } from '../../../lib/discussions';
import { getDb } from '../../../lib/server';

export const prerender = false;

const id = z.coerce.number().int().positive().max(2_147_483_647);
const bodySchema = z.object({
  threadId: id,
  /** Empty to unpin. */
  replyId: z.union([z.literal('').transform(() => null), id, z.null()]),
});

/** The asker pins the reply that helped ("Helped me"), or unpins it. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = bodySchema.safeParse(req.input);
  if (!input.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const result = await setHelped(
    getDb(),
    gate.signedIn.user.id,
    input.data.threadId,
    input.data.replyId,
  );
  if (result === 'ok') return reply(req, { ok: true });
  return reply(req, {
    ok: false,
    error: result === 'notAsker' ? 'generic' : 'notFound',
    status: result === 'notAsker' ? 403 : 404,
  });
};
