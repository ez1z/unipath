'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type BookmarkResult =
  | { saved: boolean }
  | { unauthenticated: true };

export async function toggleUniversityBookmark(
  universityId: string,
  locale: string,
): Promise<BookmarkResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { unauthenticated: true };

  const { data: profile } = await supabase
    .from('profiles')
    .select('dream_university_ids')
    .eq('id', user.id)
    .maybeSingle();

  const current: string[] = profile?.dream_university_ids ?? [];
  const isSaved = current.includes(universityId);
  const next = isSaved
    ? current.filter((id) => id !== universityId)
    : [...current, universityId];

  await supabase
    .from('profiles')
    .upsert({ id: user.id, dream_university_ids: next }, { onConflict: 'id' });

  revalidatePath(`/${locale}/tracker/profile`);
  return { saved: !isSaved };
}

export async function toggleScholarshipBookmark(
  scholarshipId: string,
  locale: string,
): Promise<BookmarkResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { unauthenticated: true };

  const { data: profile } = await supabase
    .from('profiles')
    .select('interested_scholarship_ids')
    .eq('id', user.id)
    .maybeSingle();

  const current: string[] = profile?.interested_scholarship_ids ?? [];
  const isSaved = current.includes(scholarshipId);
  const next = isSaved
    ? current.filter((id) => id !== scholarshipId)
    : [...current, scholarshipId];

  await supabase
    .from('profiles')
    .upsert({ id: user.id, interested_scholarship_ids: next }, { onConflict: 'id' });

  revalidatePath(`/${locale}/tracker/profile`);
  return { saved: !isSaved };
}
