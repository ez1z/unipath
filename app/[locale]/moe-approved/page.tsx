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

// name variants that refer to the same institution but are spelled differently
// across DB records and the MoE source rankings (kept in sync with scripts/parse-moe-list.mjs)
const NAME_ALIASES = new Map([
  ['agh university of krakow', 'agh university of science and technology'],
  ['applied science private university jordan', 'applied science private university'],
  ['ben gurion university', 'ben gurion university of the negev'],
  ['birla institute of technology and science', 'birla institute of technology and science pilani'],
  ['central queensland university', 'central queensland university australia cquniversity'],
  ['china medical university', 'china medical university taiwan'],
  ['czech university of life sciences in prague', 'czech university of life sciences prague czu'],
  ['ecole normale superieure lyon', 'ecole normale superieure de lyon'],
  ['friedrich schiller university jena', 'friedrich schiller university of jena'],
  ['heinrich heine university duesseldorf', 'heinrich heine university dusseldorf'],
  ['jamia millia islamia', 'jamia millia islamia new delhi'],
  ['johannes kepler university linz', 'johannes kepler university of linz'],
  ['manipal academy of higher education', 'manipal academy of higher education manipal university mahe'],
  ['montana state university', 'montana state university bozeman'],
  ['moscow institute of physics and technology mipt', 'moscow institute of physics and technology state university'],
  ['nanyang technological university', 'nanyang technological university singapore'],
  ['national university of science and technology', 'national university of science and technology misis'],
  ['nicolaus copernicus university', 'nicolaus copernicus university in torun'],
  ['north carolina state university', 'north carolina state university at raleigh'],
  ['ohio state university main campus', 'ohio state university columbus'],
  ['scuola normale superiore pisa', 'scuola normale superiore di pisa'],
  ['tashkent institute of irrigation and agricultural mechanisation', 'tashkent institute of irrigation and agricultural mechanization engineers national research university tiiame nru'],
  ['trinity college dublin', 'trinity college dublin the university of dublin'],
  ['universidade estadual paulista julio de mesquita filho unesp', 'universidade estadual paulista unesp'],
  ['university at buffalo', 'university at buffalo suny'],
  ['university at buffalo the state university of new york', 'university at buffalo suny'],
  ['university of bari', 'university of bari aldo moro'],
  ['university of delhi', 'university of delhi delhi'],
  ['university of galway', 'university of galway ollscoil na gaillimhe'],
  ['university of illinois chicago', 'university of illinois at chicago'],
  ['university of illinois urbana champaign', 'university of illinois at urbana champaign'],
  ['university of michigan', 'university of michigan ann arbor'],
  ['university of minnesota', 'university of minnesota twin cities'],
  ['university of new brunswick', 'university of new brunswick unb'],
  ['university of north carolina chapel hill', 'university of north carolina at chapel hill'],
  ['university of oklahoma', 'university of oklahoma norman'],
  ['university of rome ii tor vergata', 'university of rome tor vergata'],
  ['university of santiago compostela', 'university of santiago de compostela'],
  ['vellore institute of technology', 'vellore institute of technology vit vellore india'],
]);

function normalize(s: string) {
  const key = s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES.get(key) ?? key;
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
