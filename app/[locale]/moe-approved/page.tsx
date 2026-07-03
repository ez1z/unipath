import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { MoeUniversityList, type MoeEntry, type DbUniversity } from '@/components/moe/MoeUniversityList';
import { createClient } from '@/lib/supabase/server';
import { canonicalFor, localeAlternates } from '@/lib/seo';
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

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('moe_approved_title'),
    description: t('moe_approved_description'),
    alternates: {
      canonical: canonicalFor(locale, '/moe-approved'),
      languages: localeAlternates('/moe-approved'),
    },
  };
}

export default async function MoeApprovedPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('moe_approved_page');

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;

  if (user) {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    isAdmin = !!adminRow;
  }

  const { data: dbUniversities } = await supabase
    .from('universities')
    .select('id, slug, name_en, moe_approved')
    .order('name_en');

  const slugByName = new Map<string, string>();
  for (const u of dbUniversities ?? []) {
    if (u.moe_approved && u.slug && u.name_en) {
      slugByName.set(normalize(u.name_en), u.slug);
    }
  }

  const allDbUniversities: DbUniversity[] = isAdmin
    ? (dbUniversities ?? [])
        .filter((u) => !u.moe_approved && u.name_en && u.id)
        .map((u) => ({ id: u.id as string, name_en: u.name_en as string }))
    : [];

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
        <MoeUniversityList
          entries={entries}
          locale={locale}
          isAdmin={isAdmin}
          allDbUniversities={allDbUniversities}
        />
      </div>
    </>
  );
}
