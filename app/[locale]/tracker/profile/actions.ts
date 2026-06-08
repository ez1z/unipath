'use server';

import { createClient } from '@/lib/supabase/server';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { ProfileSchema } from '@/lib/data/profile-schema';

export type ProfileActionResult =
  | { success: true }
  | { success: false; error: string };

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null || v === '') return null;
  return String(v);
}

export async function updateProfileAction(
  locale: string,
  formData: FormData,
): Promise<ProfileActionResult> {
  const t = await getTranslations({ locale, namespace: 'profile' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: t('error_unauthenticated') };

  const raw = {
    display_name: emptyToNull(formData.get('display_name')),
    toefl_total: emptyToNull(formData.get('toefl_total')),
    ielts_overall: emptyToNull(formData.get('ielts_overall')),
    sat_total: emptyToNull(formData.get('sat_total')),
    act_total: emptyToNull(formData.get('act_total')),
    gre_total: emptyToNull(formData.get('gre_total')),
    gmat_total: emptyToNull(formData.get('gmat_total')),
    duolingo_score: emptyToNull(formData.get('duolingo_score')),
    gpa: emptyToNull(formData.get('gpa')),
    gpa_scale: '5.0',
    desired_countries: formData.getAll('desired_countries'),
    desired_majors: formData.getAll('desired_majors'),
    dream_university_ids: formData.getAll('dream_university_ids'),
    interested_scholarship_ids: formData.getAll('interested_scholarship_ids'),
    budget_usd: emptyToNull(formData.get('budget_usd')),
  };

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: t('error_invalid_data') };
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...parsed.data }, { onConflict: 'id' });

  if (error) return { success: false, error: t('error_save_failed') };

  revalidatePath(`/${locale}/tracker/profile`);
  return { success: true };
}
