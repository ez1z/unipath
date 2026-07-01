'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperuser, logAction } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function deleteReportedMessageAction(messageId: string) {
  const { user } = await requireSuperuser();
  const service = createServiceClient();
  await service.from('discussion_messages').update({ is_deleted: true }).eq('id', messageId);
  await service.from('discussion_reports').update({ status: 'resolved' }).eq('message_id', messageId);
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email ?? '',
    action: 'delete_discussion_message',
    entityType: 'discussion_message',
    entityId: messageId,
  });
  revalidatePath('/admin/discussions');
}

export async function dismissReportAction(reportId: string) {
  await requireSuperuser();
  const service = createServiceClient();
  await service.from('discussion_reports').update({ status: 'dismissed' }).eq('id', reportId);
  revalidatePath('/admin/discussions');
}
