import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/lib/constants';
import type { DiscussionMessageDbRow, EntityType } from './discussion-types';
import { buildTree } from './discussion-types';

export type { DiscussionMessage, EntityType } from './discussion-types';
export { buildTree } from './discussion-types';

/** Mask an email for public display: "alex@mail.com" -> "al***@mail.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return 'anonymous';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

export type Viewer = {
  authed: boolean;
  userId: string | null;
  nickname: string | null;
  promptDismissed: boolean;
  maskedEmail: string | null;
};

export async function getViewer(supabase: SupabaseClient): Promise<Viewer> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { authed: false, userId: null, nickname: null, promptDismissed: false, maskedEmail: null };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, nickname_prompt_dismissed')
    .eq('id', user.id)
    .maybeSingle();
  return {
    authed: true,
    userId: user.id,
    nickname: (profile?.nickname as string | null) ?? null,
    promptDismissed: !!profile?.nickname_prompt_dismissed,
    maskedEmail: user.email ? maskEmail(user.email) : null,
  };
}

export async function getThread(
  entityType: EntityType,
  entityId: string,
  viewerId: string | null,
  sort: 'top' | 'new',
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discussion_messages')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw new Error(`Failed to fetch discussion: ${error.message}`);
  const rows = (data ?? []) as DiscussionMessageDbRow[];

  const votes = new Map<string, -1 | 1>();
  if (viewerId && rows.length > 0) {
    const { data: voteRows } = await supabase
      .from('discussion_votes')
      .select('message_id, value')
      .eq('user_id', viewerId)
      .in('message_id', rows.map((r) => r.id));
    for (const v of voteRows ?? []) votes.set(v.message_id as string, v.value as -1 | 1);
  }

  return buildTree(rows, votes, sort);
}

export async function getMessageCount(entityType: EntityType, entityId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('discussion_messages')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('is_deleted', false);
  return count ?? 0;
}

export type FeedItem = {
  id: string;
  entityType: EntityType;
  entitySlug: string;
  entityName: string;
  authorLabel: string;
  body: string;
  score: number;
  createdAt: string;
};

type FeedRow = {
  id: string;
  entity_type: EntityType;
  author_label: string;
  body: string;
  score: number;
  created_at: string;
  uni_slug: string | null;
  uni_tk: string | null; uni_ru: string | null; uni_en: string | null;
  sch_slug: string | null;
  sch_tk: string | null; sch_ru: string | null; sch_en: string | null;
};

export async function getRecentFeed(locale: Locale, limit = 40): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discussion_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch feed: ${error.message}`);
  return ((data ?? []) as FeedRow[]).map((r) => {
    const isUni = r.entity_type === 'university';
    const name = isUni
      ? r[`uni_${locale}`] ?? r.uni_en
      : r[`sch_${locale}`] ?? r.sch_en;
    return {
      id: r.id,
      entityType: r.entity_type,
      entitySlug: (isUni ? r.uni_slug : r.sch_slug) ?? '',
      entityName: name ?? '',
      authorLabel: r.author_label,
      body: r.body,
      score: r.score,
      createdAt: r.created_at,
    };
  });
}
