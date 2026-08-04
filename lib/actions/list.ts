'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  ListEntrySchema,
  ListEntriesSchema,
  ColumnLayoutSchema,
  MAX_ENTRIES,
  type ColumnDef,
  type ListEntry,
} from '@/lib/data/list-types';
import { ListViewSchema } from '@/lib/list/view';

export type ListActionResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'invalid' | 'limit' | 'failed' };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function upsertEntryAction(
  locale: string,
  raw: unknown,
): Promise<ListActionResult> {
  const parsed = ListEntrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // Only a new university counts against the cap; edits to an existing row
  // must keep working even if the cap is later lowered.
  const { count } = await supabase
    .from('application_entries')
    .select('university_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('university_id', parsed.data.university_id);

  if ((count ?? 0) >= MAX_ENTRIES) return { ok: false, error: 'limit' };

  const { error } = await supabase
    .from('application_entries')
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id,university_id' });

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

export async function removeEntryAction(
  locale: string,
  universityId: string,
): Promise<ListActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('application_entries')
    .delete()
    .eq('user_id', user.id)
    .eq('university_id', universityId);

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

export async function reorderEntriesAction(
  locale: string,
  universityIdsInOrder: string[],
): Promise<ListActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { data: existing } = await supabase
    .from('application_entries')
    .select('*')
    .eq('user_id', user.id);

  if (!existing) return { ok: false, error: 'failed' };

  // Position comes from the submitted order; every other field is carried over
  // untouched, so a reorder can never clobber a concurrent cell edit.
  const position = new Map(universityIdsInOrder.map((id, i) => [id, i]));
  const rows = existing
    .filter((row) => position.has(row.university_id as string))
    .map((row) => ({ ...row, sort_order: position.get(row.university_id as string)! }));

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase
    .from('application_entries')
    .upsert(rows, { onConflict: 'user_id,university_id' });

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

export async function setColumnsAction(
  locale: string,
  columns: unknown,
): Promise<ListActionResult> {
  const parsed = ColumnLayoutSchema.safeParse(columns);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, list_columns: parsed.data }, { onConflict: 'id' });

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

export async function setViewAction(locale: string, view: unknown): Promise<ListActionResult> {
  const parsed = ListViewSchema.safeParse(view);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, list_view: parsed.data }, { onConflict: 'id' });

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

/** Bulk insert used once, when a guest signs in and their local rows are adopted. */
export async function importEntriesAction(
  locale: string,
  entries: unknown,
  columns: unknown,
  view: unknown,
): Promise<ListActionResult> {
  const parsedEntries = ListEntriesSchema.safeParse(entries);
  const parsedColumns = ColumnLayoutSchema.safeParse(columns);
  const parsedView = ListViewSchema.safeParse(view);
  if (!parsedEntries.success || !parsedColumns.success || !parsedView.success) {
    return { ok: false, error: 'invalid' };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  if (parsedEntries.data.length > 0) {
    const rows = parsedEntries.data.map((e: ListEntry) => ({ user_id: user.id, ...e }));
    const { error } = await supabase
      .from('application_entries')
      .upsert(rows, { onConflict: 'user_id,university_id' });
    if (error) return { ok: false, error: 'failed' };
  }

  const { error: colError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      list_columns: parsedColumns.data as ColumnDef[],
      list_view: parsedView.data,
    },
    { onConflict: 'id' },
  );

  if (colError) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}
