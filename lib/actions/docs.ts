'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DocsDiffSchema, isEmptyDiff, DocsDiffMapSchema } from '@/lib/docs/types';

export type DocsActionResult = { ok: true } | { ok: false; error: 'unauthenticated' | 'invalid' | 'failed' };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const UniversityIdSchema = z.string().uuid();

export async function setDocsAction(
  locale: string,
  universityId: string,
  raw: unknown,
): Promise<DocsActionResult> {
  const parsedId = UniversityIdSchema.safeParse(universityId);
  const parsed = DocsDiffSchema.safeParse(raw);
  if (!parsedId.success || !parsed.success) return { ok: false, error: 'invalid' };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  // An empty diff carries no information, so it is an absent row rather than a
  // stored one — otherwise every university a student merely expanded would
  // leave a row behind.
  if (isEmptyDiff(parsed.data)) {
    const { error } = await supabase
      .from('document_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('university_id', parsedId.data);

    if (error) return { ok: false, error: 'failed' };
  } else {
    const { error } = await supabase.from('document_progress').upsert(
      { user_id: user.id, university_id: parsedId.data, ...parsed.data },
      { onConflict: 'user_id,university_id' },
    );

    if (error) return { ok: false, error: 'failed' };
  }

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}

/** Bulk insert used once, when a guest signs in and their local progress is adopted. */
export async function importDocsAction(locale: string, raw: unknown): Promise<DocsActionResult> {
  const parsed = DocsDiffMapSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const entries = Object.entries(parsed.data).filter(([, diff]) => !isEmptyDiff(diff));
  if (entries.length === 0) return { ok: true };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  const rows = entries.map(([universityId, diff]) => ({
    user_id: user.id,
    university_id: universityId,
    ...diff,
  }));

  // `ignoreDuplicates` is what makes adoption safe to run more than once: the
  // account's own progress is authoritative and must never be overwritten by a
  // stale copy from a shared browser.
  const { error } = await supabase
    .from('document_progress')
    .upsert(rows, { onConflict: 'user_id,university_id', ignoreDuplicates: true });

  if (error) return { ok: false, error: 'failed' };

  revalidatePath(`/${locale}/compare`);
  return { ok: true };
}
