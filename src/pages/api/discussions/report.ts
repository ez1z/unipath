import type { APIRoute } from 'astro';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { reportPost, reportSchema } from '../../../lib/discussions';
import { getDb } from '../../../lib/server';

export const prerender = false;

/** Report a question or reply. Three reports from different students hide it. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const input = reportSchema.safeParse(req.input);
  if (!input.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const result = await reportPost(getDb(), gate.signedIn.user.id, input.data);
  if (result.ok) return reply(req, { ok: true, body: { hidden: result.hidden } });
  return reply(req, {
    ok: false,
    error: result.error,
    status: result.error === 'own' ? 403 : 404,
  });
};
