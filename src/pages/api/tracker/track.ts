import type { APIRoute } from 'astro';
import { ensureProfile, serializePendingAction } from '../../../lib/account';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { getDb } from '../../../lib/server';
import { trackTarget, trackTargetSchema } from '../../../lib/tracker';

export const prerender = false;

/**
 * "Track this" on a program, pathway or scholarship. Signed out, the form goes
 * to sign-in and tracking finishes right after. Then: the item's page.
 */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const target = trackTargetSchema.safeParse(req.input);
  if (!target.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const gate = await requireWriter(
    request,
    req,
    serializePendingAction({ kind: 'track', target: target.data }),
  );
  if (!gate.ok) return gate.response;
  const db = getDb();
  await ensureProfile(db, gate.signedIn.user.id, req.lang);
  const result = await trackTarget(db, gate.signedIn.user.id, target.data);
  if (!result.ok) {
    return reply(req, {
      ok: false,
      error: result.error,
      status: result.error === 'limit' ? 409 : 404,
    });
  }
  return reply(req, {
    ok: true,
    body: { id: result.id, created: result.created },
    to: `/${req.lang}/my/tracker/${result.id}`,
  });
};
