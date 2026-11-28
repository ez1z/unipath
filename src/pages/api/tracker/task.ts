import type { APIRoute } from 'astro';
import * as z from 'zod';
import { json, readWrite, reply, requireWriter } from '../../../lib/api';
import { getDb } from '../../../lib/server';
import { addTask, deleteTask, setTaskDone, taskTitleSchema } from '../../../lib/tracker';

export const prerender = false;

const id = z.coerce.number().int().positive().max(2_147_483_647);
const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('done'),
    itemId: id,
    taskId: id,
    done: z.union([z.boolean(), z.enum(['1', '0']).transform((v) => v === '1')]),
  }),
  z.object({ action: z.literal('add'), itemId: id, title: taskTitleSchema }),
  z.object({ action: z.literal('delete'), itemId: id, taskId: id }),
]);

/** Tick a checklist task, add the student's own, or remove one. */
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
  if (b.action === 'add') {
    const result = await addTask(db, userId, b.itemId, b.title);
    if (result === 'ok') return reply(req, { ok: true });
    return reply(req, { ok: false, error: result, status: result === 'limit' ? 409 : 404 });
  }
  const found =
    b.action === 'done'
      ? await setTaskDone(db, userId, b.itemId, b.taskId, b.done)
      : await deleteTask(db, userId, b.itemId, b.taskId);
  return found
    ? reply(req, { ok: true })
    : reply(req, { ok: false, error: 'notFound', status: 404 });
};
