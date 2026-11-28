import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { auditInsert } from '../../../lib/admin/audit';
import { requireAdmin } from '../../../lib/admin/guard';
import { checkImage, IMAGE_LIMITS, type ImageKind } from '../../../lib/admin/images';
import { filesBucket, getDb } from '../../../lib/server';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Admin only: stores a logo or photo, already resized to WebP in the admin's
 * browser, in R2 under a new random key. The server checks the type, the
 * size in bytes and the pixel size; the key is saved with the record's form.
 */
export const POST: APIRoute = async ({ request }) => {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return json({ error: 'forbidden' }, 403);
  const files = filesBucket();
  if (!files) return json({ error: 'files-off' }, 503);
  const limit = await env.WRITE_LIMITER.limit({ key: `write:${admin.adminId}` });
  if (!limit.success) return json({ error: 'rate' }, 429);

  const form = await request.formData().catch(() => null);
  const kind = form?.get('kind');
  const file = form?.get('file');
  if ((kind !== 'logo' && kind !== 'photo') || !(file instanceof File)) {
    return json({ error: 'input' }, 400);
  }
  const imageKind: ImageKind = kind;
  if (file.size > IMAGE_LIMITS[imageKind].maxBytes) return json({ error: 'size' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(imageKind, bytes);
  if (!check.ok) return json({ error: check.reason }, 422);

  const key = `${IMAGE_LIMITS[imageKind].prefix}${crypto.randomUUID()}.webp`;
  await files.put(key, bytes, {
    httpMetadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  await auditInsert(getDb(), {
    adminId: admin.adminId,
    action: 'upload',
    entityType: 'file',
    entityId: key,
    diff: { kind: imageKind, width: check.width, height: check.height, bytes: bytes.length },
  });
  return json({ key, width: check.width, height: check.height });
};
