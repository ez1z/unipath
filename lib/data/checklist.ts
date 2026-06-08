import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import type { ChecklistItem } from './checklist-types';

const DEFAULT_ITEM_KEYS = [
  'default_passport',
  'default_transcript',
  'default_recommendation_letters',
  'default_toefl',
  'default_sat',
  'default_visa_documents',
] as const;

export async function getOrInitChecklist(
  universityId: string,
  locale: string,
): Promise<ChecklistItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: existing } = await supabase
    .from('document_checklist_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('university_id', universityId)
    .order('sort_order');

  if (existing && existing.length > 0) {
    return existing as ChecklistItem[];
  }

  const t = await getTranslations({ locale, namespace: 'checklist' });
  const defaults = DEFAULT_ITEM_KEYS.map((key, i) => ({
    user_id: user.id,
    university_id: universityId,
    name: t(key),
    is_checked: false,
    sort_order: i,
  }));

  const { data: seeded } = await supabase
    .from('document_checklist_items')
    .insert(defaults)
    .select()
    .order('sort_order');

  return (seeded ?? []) as ChecklistItem[];
}

export async function getChecklistProgress(
  universityIds: string[],
): Promise<Record<string, { total: number; checked: number }>> {
  if (!universityIds.length) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from('document_checklist_items')
    .select('university_id, is_checked')
    .eq('user_id', user.id)
    .in('university_id', universityIds);

  const progress: Record<string, { total: number; checked: number }> = {};
  for (const item of data ?? []) {
    const uid = item.university_id as string;
    if (!progress[uid]) progress[uid] = { total: 0, checked: 0 };
    progress[uid].total++;
    if (item.is_checked) progress[uid].checked++;
  }
  return progress;
}
