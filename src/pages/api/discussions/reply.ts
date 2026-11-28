import type { APIRoute } from 'astro';
import * as z from 'zod';
import { ensureProfile, profileSchema, updateProfile } from '../../../lib/account';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { createReply, replyBodySchema } from '../../../lib/discussions';
import { getDb } from '../../../lib/server';

export const prerender = false;

const bodySchema = z.object({
  threadId: z.coerce.number().int().positive().max(2_147_483_647),
  body: replyBodySchema,
});

/** Reply to a question: thirty replies per user per day. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = bodySchema.safeParse(req.input);
  const nickname = profileSchema.shape.displayName.safeParse(req.input['nickname'] ?? undefined);
  if (!input.success || !nickname.success) {
    return reply(req, { ok: false, error: 'invalid', status: 400 });
  }

  const db = getDb();
  const userId = gate.signedIn.user.id;
  const result = await createReply(db, userId, input.data.threadId, input.data.body);
  if (!result.ok) {
    const status = result.error === 'daily' ? 429 : result.error === 'notFound' ? 404 : 409;
    return reply(req, { ok: false, error: result.error, status });
  }
  if (nickname.data) {
    const profile = await ensureProfile(db, userId, req.lang);
    if (!profile.displayName) await updateProfile(db, userId, { displayName: nickname.data });
  }
  const back = req.back.split('#')[0] ?? req.back;
  return reply(req, { ok: true, to: `${back}#reply-${result.id}`, body: { id: result.id } });
};
