'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAction } from '@/lib/admin/auth';
import { resolveLabel } from '@/lib/data/discussions';

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

const EntityType = z.enum(['university', 'scholarship', 'general']);

const PostSchema = z
  .object({
    entityType: EntityType,
    entityId: z.string().uuid().nullable(),
    parentId: z.string().uuid().nullable().optional(),
    body: z.string().trim().min(1).max(4000),
  })
  .refine(
    (d) => (d.entityType === 'general' ? d.entityId === null : d.entityId !== null),
    { message: 'entityId must be null only for general discussions', path: ['entityId'] },
  );

const MAX_POSTS_PER_WINDOW = 5;
const WINDOW_MS = 30_000;

export async function postMessageAction(
  locale: string,
  input: z.input<typeof PostSchema>,
): Promise<ActionResult> {
  const t = await getTranslations({ locale, namespace: 'discussions' });
  const parsed = PostSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t('error_invalid') };
  const { entityType, entityId, parentId, body } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: t('error_signin') };

  // Rate limit: cap posts per short window per user.
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('discussion_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= MAX_POSTS_PER_WINDOW) {
    return { success: false, error: t('error_rate') };
  }

  // Snapshot the profile display name as the author label (join-free at read time).
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const label = resolveLabel((profile?.display_name as string | null) ?? null, user.email ?? null);

  const { error } = await supabase.from('discussion_messages').insert({
    entity_type: entityType,
    entity_id: entityId,
    parent_id: parentId ?? null,
    user_id: user.id,
    author_label: label,
    body,
  });
  if (error) return { success: false, error: t('error_save') };
  return { success: true };
}

const VoteSchema = z.object({
  messageId: z.string().uuid(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export async function voteAction(
  locale: string,
  input: z.input<typeof VoteSchema>,
): Promise<ActionResult> {
  const t = await getTranslations({ locale, namespace: 'discussions' });
  const parsed = VoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t('error_invalid') };
  const { messageId, value } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: t('error_signin') };

  if (value === 0) {
    await supabase.from('discussion_votes').delete().eq('message_id', messageId).eq('user_id', user.id);
  } else {
    await supabase
      .from('discussion_votes')
      .upsert({ message_id: messageId, user_id: user.id, value }, { onConflict: 'message_id,user_id' });
  }
  return { success: true };
}

const ReportSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function reportMessageAction(
  locale: string,
  input: z.input<typeof ReportSchema>,
): Promise<ActionResult> {
  const t = await getTranslations({ locale, namespace: 'discussions' });
  const parsed = ReportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t('error_invalid') };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: t('error_signin') };

  // Unique (message, reporter) — a duplicate report is a no-op success.
  await supabase.from('discussion_reports').upsert(
    { message_id: parsed.data.messageId, reporter_id: user.id, reason: parsed.data.reason ?? null },
    { onConflict: 'message_id,reporter_id' },
  );
  return { success: true };
}

export async function deleteMessageAction(locale: string, messageId: string): Promise<ActionResult> {
  const t = await getTranslations({ locale, namespace: 'discussions' });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: t('error_signin') };

  const { data: adminRow } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminRow?.role !== 'superuser') return { success: false, error: t('error_forbidden') };

  const service = createServiceClient();
  const { error } = await service
    .from('discussion_messages')
    .update({ is_deleted: true })
    .eq('id', messageId);
  if (error) return { success: false, error: t('error_save') };

  // Resolve any open reports on this message.
  await service.from('discussion_reports').update({ status: 'resolved' }).eq('message_id', messageId);

  await logAction({
    adminUserId: user.id,
    adminEmail: user.email ?? '',
    action: 'delete_discussion_message',
    entityType: 'discussion_message',
    entityId: messageId,
  });
  return { success: true };
}
