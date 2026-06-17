import { readFileSync } from 'fs';
import { join } from 'path';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { MoeUniversityList, type MoeEntry } from '@/components/moe/MoeUniversityList';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type RawMoeEntry = { name: string; country: string };

function loadMoeList(): RawMoeEntry[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'moe-universities.json'), 'utf8');
    return JSON.parse(raw) as RawMoeEntry[];
  } catch {
    return [];
  }
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

type Props = { params: { locale: Locale } };

export default async function MoeApprovedPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('moe_approved_page');

  const supabase = await createClient();
  const { data: dbUniversities } = await supabase
    .from('universities')
    .select('slug, name_en, moe_approved')
    .eq('moe_approved', true);

  // Build a map of normalized name → slug for fast lookup
  const slugByName = new Map<string, string>();
  for (const u of dbUniversities ?? []) {
    if (u.slug && u.name_en) {
      slugByName.set(normalize(u.name_en), u.slug);
    }
  }

  const moeList = loadMoeList();
  const entries: MoeEntry[] = moeList.map((entry) => ({
    name: entry.name,
    country: entry.country,
    slug: slugByName.get(normalize(entry.name)),
  }));

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground text-sm mb-8 max-w-2xl">{t('subtitle')}</p>
        <MoeUniversityList entries={entries} locale={locale} />
      </div>
    </>
  );
}
