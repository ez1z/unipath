'use server';

import { createClient } from '@/lib/supabase/server';
import type { ChecklistItem } from '@/lib/data/checklist-types';

export async function toggleChecklistItem(
  itemId: string,
  isChecked: boolean,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from('document_checklist_items')
    .update({ is_checked: isChecked, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('user_id', user.id);

  return { ok: !error };
}

export async function addChecklistItem(
  universityId: string,
  name: string,
): Promise<{ item: ChecklistItem } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthenticated' };

  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { error: 'empty' };

  const { data: max } = await supabase
    .from('document_checklist_items')
    .select('sort_order')
    .eq('user_id', user.id)
    .eq('university_id', universityId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((max?.sort_order as number | null) ?? -1) + 1;

  const { data, error } = await supabase
    .from('document_checklist_items')
    .insert({
      user_id: user.id,
      university_id: universityId,
      name: trimmed,
      is_checked: false,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? 'insert failed' };
  return { item: data as ChecklistItem };
}

export async function deleteChecklistItem(
  itemId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from('document_checklist_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id);

  return { ok: !error };
}
