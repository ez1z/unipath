import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getBySlug } from '@/lib/data/scholarships';
import { PageHeader } from '@/components/ui/PageHeader';
import { DiscussionSection } from '@/components/discussion/DiscussionSection';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale; id: string } };

export default async function ScholarshipDiscussionPage({ params: { locale, id } }: Props) {
  setRequestLocale(locale);
  const scholarship = await getBySlug(id);
  if (!scholarship) notFound();

  const t = await getTranslations('discussions');
  const name = scholarship.name[locale] ?? scholarship.name.en;

  return (
    <>
      <PageHeader
        title={t('page_title', { name })}
        subtitle={t('page_subtitle')}
        backHref={`/${locale}/scholarships/${scholarship.slug}`}
        backLabel={name}
      />
      <div className="container mx-auto px-5 py-8 max-w-3xl">
        <DiscussionSection locale={locale} entityType="scholarship" entityId={scholarship.id} />
      </div>
    </>
  );
}
