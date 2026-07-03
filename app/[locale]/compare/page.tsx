import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll } from '@/lib/data/universities';
import { CompareClient } from '@/components/university/CompareClient';
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

export default async function ComparePage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('compare');
  const universities = await getAll();

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="container mx-auto px-4 py-8">
        <CompareClient universities={universities} locale={locale} />
      </div>
    </>
  );
}
