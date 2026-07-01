import { createClient } from '@/lib/supabase/server';
import { getThread, getViewer } from '@/lib/data/discussions';
import type { EntityType } from '@/lib/data/discussion-types';
import type { Locale } from '@/lib/constants';
import { DiscussionThread } from './DiscussionThread';

type Props = {
  locale: Locale;
  entityType: EntityType;
  entityId: string;
};

// Server component: loads viewer + thread, then hands off to the client thread.
export async function DiscussionSection({ locale, entityType, entityId }: Props) {
  const supabase = await createClient();
  const viewer = await getViewer(supabase);

  let isSuperuser = false;
  if (viewer.userId) {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('role')
      .eq('user_id', viewer.userId)
      .maybeSingle();
    isSuperuser = adminRow?.role === 'superuser';
  }

  const messages = await getThread(entityType, entityId, viewer.userId, 'top');

  return (
    <DiscussionThread
      locale={locale}
      entityType={entityType}
      entityId={entityId}
      messages={messages}
      viewer={{
        authed: viewer.authed,
        nickname: viewer.nickname,
        promptDismissed: viewer.promptDismissed,
        maskedEmail: viewer.maskedEmail,
      }}
      isSuperuser={isSuperuser}
    />
  );
}
