import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { getDb } from '../../../lib/server';
import {
  deadlineSchema,
  deleteItem,
  notesSchema,
  setDeadline,
  setNotes,
  setStage,
  stageSchema,
} from '../../../lib/tracker';

export const prerender = false;

const id = z.coerce.number().int().positive().max(2_147_483_647);
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stage'), id, stage: stageSchema }),
  z.object({ action: z.literal('notes'), id, notes: notesSchema }),
  z.object({ action: z.literal('deadline'), id, deadline: deadlineSchema }),
  z.object({ action: z.literal('delete'), id, confirm: z.literal('1') }),
]);

/** Change a tracked item's stage, notes or deadline, or stop tracking it. */
export const POST: APIRoute = async ({ request }) => {
  const req = await readWrite(request);
  if (!req) return json({ error: 'invalid' }, 400);
  const gate = await requireWriter(request, req);
  if (!gate.ok) return gate.response;
  const body = bodySchema.safeParse(req.input);
  if (!body.success) return reply(req, { ok: false, error: 'invalid', status: 400 });

  const db = getDb();
  const userId = gate.signedIn.user.id;
  const b = body.data;
  let found: boolean;
  if (b.action === 'stage') found = await setStage(db, userId, b.id, b.stage);
  else if (b.action === 'notes') found = await setNotes(db, userId, b.id, b.notes);
  else if (b.action === 'deadline') found = await setDeadline(db, userId, b.id, b.deadline);
  else found = await deleteItem(db, userId, b.id);

  if (!found) return reply(req, { ok: false, error: 'notFound', status: 404 });
  return reply(req, {
    ok: true,
    to: b.action === 'delete' ? `/${req.lang}/my` : undefined,
  });
};
