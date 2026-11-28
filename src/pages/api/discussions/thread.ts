import type { APIRoute } from 'astro';
import { ensureProfile, profileSchema, updateProfile } from '../../../lib/account';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { createThread, threadInputSchema } from '../../../lib/discussions';
import { threadPath } from '../../../lib/discussions-view';
import { getDb } from '../../../lib/server';

export const prerender = false;

/**
 * Ask a question. Form fields: topic, title, body, postLang, universityId?,
 * programId?, nickname? (only offered while the student has none).
 * Five questions per user per day; the sixth gets `daily`.
 */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = threadInputSchema.safeParse(req.input);
  const nickname = profileSchema.shape.displayName.safeParse(req.input['nickname'] ?? undefined);
  if (!input.success || !nickname.success) {
    return reply(req, { ok: false, error: 'invalid', status: 400 });
  }

  const db = getDb();
  const userId = gate.signedIn.user.id;
  const result = await createThread(db, userId, input.data);
  if (!result.ok) {
    return reply(req, {
      ok: false,
      error: result.error,
      status: result.error === 'daily' ? 429 : 400,
    });
  }
  if (nickname.data) {
    const profile = await ensureProfile(db, userId, req.lang);
    if (!profile.displayName) await updateProfile(db, userId, { displayName: nickname.data });
  }
  const to = threadPath(req.lang, input.data.topic, result.id);
  return reply(req, { ok: true, to, body: { id: result.id, href: to } });
};
