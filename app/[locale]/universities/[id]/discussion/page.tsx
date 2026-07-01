import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getBySlug } from '@/lib/data/universities';
import { PageHeader } from '@/components/ui/PageHeader';
import { DiscussionSection } from '@/components/discussion/DiscussionSection';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale; id: string } };

export default async function UniversityDiscussionPage({ params: { locale, id } }: Props) {
  setRequestLocale(locale);
  const university = await getBySlug(id);
  if (!university) notFound();

  const t = await getTranslations('discussions');
  const name = university.name[locale] ?? university.name.en;

  return (
    <>
      <PageHeader
        title={t('page_title', { name })}
        subtitle={t('page_subtitle')}
        backHref={`/${locale}/universities/${university.slug}`}
        backLabel={name}
      />
      <div className="container mx-auto px-5 py-8 max-w-3xl">
        <DiscussionSection locale={locale} entityType="university" entityId={university.id} />
      </div>
    </>
  );
}
