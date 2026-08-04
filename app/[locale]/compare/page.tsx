import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll } from '@/lib/data/universities';
import { getAll as getAllScholarships } from '@/lib/data/scholarships';
import { getDocsDiffs } from '@/lib/data/docs';
import { createClient } from '@/lib/supabase/server';
import { dbRowToListEntry, normalizeColumns, type ListEntry } from '@/lib/data/list-types';
import { normalizeView, type ListView } from '@/lib/list/view';
import type { FitProfile } from '@/lib/data/fit';
import type { DocsDiffMap } from '@/lib/docs/types';
import { ListClient } from '@/components/list/ListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { canonicalFor, localeAlternates } from '@/lib/seo';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('compare_title'),
    description: t('compare_description'),
    alternates: {
      canonical: canonicalFor(locale, '/compare'),
      languages: localeAlternates('/compare'),
    },
  };
}

export default async function ListPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('list');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [universities, scholarships] = await Promise.all([getAll(), getAllScholarships()]);

  let entries: ListEntry[] = [];
  let columns = normalizeColumns([]);
  let view: ListView = normalizeView({});
  let profile: FitProfile | null = null;
  let docsDiffs: DocsDiffMap = {};

  // Signed out is a supported mode, not an error: the page renders empty and
  // the client fills it from whatever the guest has in localStorage.
  if (user) {
    const [entryResult, profileResult] = await Promise.all([
      supabase
        .from('application_entries')
        .select(
          'university_id, tier, status, scholarship_ids, notes, semester_key, custom, sort_order',
        )
        .eq('user_id', user.id)
        .order('sort_order'),
      supabase
        .from('profiles')
        .select(
          'toefl_total, ielts_overall, sat_total, duolingo_score, budget_usd, list_columns, list_view',
        )
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    entries = (entryResult.data ?? []).map(dbRowToListEntry);
    columns = normalizeColumns(profileResult.data?.list_columns);
    view = normalizeView(profileResult.data?.list_view);

    if (profileResult.data) {
      const p = profileResult.data;
      profile = {
        toefl_total: p.toefl_total,
        ielts_overall: p.ielts_overall,
        sat_total: p.sat_total,
        duolingo_score: p.duolingo_score,
        budget_usd: p.budget_usd,
      };
    }

    docsDiffs = await getDocsDiffs(entries.map((e) => e.university_id));
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="container mx-auto px-4 py-8">
        <ListClient
          locale={locale}
          isSignedIn={Boolean(user)}
          universities={universities}
          scholarships={scholarships}
          initialEntries={entries}
          initialColumns={columns}
          initialView={view}
          docsDiffs={docsDiffs}
          profile={profile}
        />
      </div>
    </>
  );
}
