'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, logAction } from '@/lib/admin/auth';
import { COVERAGE_ITEMS } from '@/lib/data/scholarship-types';
import { ScholarshipFormSchema } from '@/lib/data/scholarship-schema';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { slugify } from '@/lib/utils/slugify';
type SupabaseClient = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

async function generateScholarshipSlug(
  supabase: SupabaseClient,
  nameEn: string,
  country: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(`${nameEn}-${country}`);
  let candidate = base;
  let suffix = 2;
  while (true) {
    let query = supabase.from('scholarships').select('id').eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

function revalidateScholarshipPaths() {
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/scholarships`);
  }
}

export async function createScholarshipAction(
  formData: FormData
): Promise<{ error: string } | never> {
  const { supabase, user } = await requireAdmin();

  const raw: Record<string, string> = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)])
  );

  const selectedCoverage = COVERAGE_ITEMS.filter((item) => formData.get(`coverage_${item}`) === 'on');
  raw.coverage = selectedCoverage.join(',');

  const parsed = ScholarshipFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const slug = await generateScholarshipSlug(supabase, parsed.data.name_en, parsed.data.country);

  const { error } = await supabase.from('scholarships').insert({
    slug,
    university_id: parsed.data.university_id,
    country: parsed.data.country,
    name_en: parsed.data.name_en,
    name_ru: parsed.data.name_ru,
    name_tk: parsed.data.name_tk,
    type: parsed.data.type,
    coverage: parsed.data.coverage,
    amount_usd: parsed.data.amount_usd,
    deadline_text: parsed.data.deadline_text,
    description_en: parsed.data.description_en,
    description_ru: parsed.data.description_ru,
    description_tk: parsed.data.description_tk,
    application_url: parsed.data.application_url,
  });

  if (error) return { error: error.message };

  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'create_scholarship',
    entityType: 'scholarship',
    entityName: parsed.data.name_en,
  });
  redirect('/admin/scholarships');
}

export async function updateScholarshipAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | never> {
  const { supabase, user } = await requireAdmin();

  const raw: Record<string, string> = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)])
  );

  const selectedCoverage = COVERAGE_ITEMS.filter((item) => formData.get(`coverage_${item}`) === 'on');
  raw.coverage = selectedCoverage.join(',');

  const parsed = ScholarshipFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const slug = await generateScholarshipSlug(supabase, parsed.data.name_en, parsed.data.country, id);

  const { error } = await supabase
    .from('scholarships')
    .update({
      slug,
      university_id: parsed.data.university_id,
      country: parsed.data.country,
      name_en: parsed.data.name_en,
      name_ru: parsed.data.name_ru,
      name_tk: parsed.data.name_tk,
      type: parsed.data.type,
      coverage: parsed.data.coverage,
      amount_usd: parsed.data.amount_usd,
      deadline_text: parsed.data.deadline_text,
      description_en: parsed.data.description_en,
      description_ru: parsed.data.description_ru,
      description_tk: parsed.data.description_tk,
      application_url: parsed.data.application_url,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'update_scholarship',
    entityType: 'scholarship',
    entityId: id,
    entityName: parsed.data.name_en,
  });
  redirect('/admin/scholarships');
}

export async function deleteScholarshipAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from('scholarships').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'delete_scholarship',
    entityType: 'scholarship',
    entityId: id,
  });
  return { success: true };
}
