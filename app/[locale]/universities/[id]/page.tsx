import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getBySlug } from '@/lib/data/universities';
import { formatTuition } from '@/lib/format';
import { MoeBadge } from '@/components/university/MoeBadge';
import { EntranceRequirements } from '@/components/university/EntranceRequirements';
import { ScholarshipSection } from '@/components/scholarship/ScholarshipSection';
import { GulPattern } from '@/components/ui/GulPattern';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';

type Props = { params: { locale: Locale; id: string } };

export const dynamic = 'force-dynamic';

export default async function UniversityDetailPage({ params: { locale, id } }: Props) {
  const university = await getBySlug(id);
  if (!university) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isSaved = false;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('dream_university_ids')
      .eq('id', user.id)
      .maybeSingle();
    isSaved = (data?.dream_university_ids ?? []).includes(university.id);
  }

  const t = await getTranslations('university');
  const name = university.name[locale] ?? university.name.en;

  return (
    <>
      {/* Hero banner */}
      <div className="bg-primary relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <GulPattern size={180} className="text-gold" />
        </div>
        <div className="container mx-auto px-4 py-10 relative">
          <Link
            href={`/${locale}/universities`}
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/60 hover:text-gold transition-colors mb-5"
            aria-label={t('back')}
          >
            ← {t('back')}
          </Link>
          <div className="flex flex-wrap items-start gap-2 mb-1">
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-primary-foreground leading-tight">
              {name}
            </h1>
            {university.moe_approved && (
              <div className="mt-1 flex-shrink-0">
                <MoeBadge />
              </div>
            )}
          </div>
          <p className="text-primary-foreground/60 mt-2">
            {university.city}, {university.country}
          </p>
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Key stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border border-t-4 border-t-primary rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t('tuition')}</div>
            <div className="font-heading font-bold text-lg text-foreground">{formatTuition(university.tuition_usd)}</div>
          </div>
          <div className="bg-card border border-border border-t-4 border-t-gold rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t('ranking')}</div>
            <div className="font-heading font-bold text-lg text-foreground">
              {university.ranking_qs
                ? t('ranking_value', { rank: university.ranking_qs })
                : t('ranking_unranked')}
            </div>
          </div>
        </div>

        {/* Languages */}
        <section className="mb-6">
          <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
            {t('languages')}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {university.languages.map((lang) => (
              <span
                key={lang}
                className="px-3 py-1 bg-gold/10 text-gold-dark border border-gold/30 rounded-full text-sm font-medium"
              >
                {lang.toUpperCase()}
              </span>
            ))}
          </div>
        </section>

        {/* Majors */}
        <section className="mb-6">
          <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
            {t('majors')}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {university.majors.map((major) => (
              <span
                key={major}
                className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm border border-border"
              >
                {major}
              </span>
            ))}
          </div>
        </section>

        {/* Entrance requirements */}
        <section className="mb-8">
          <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
            {t('requirements')}
          </h2>
          <EntranceRequirements requirements={university.entrance_requirements} />
        </section>

        {/* Scholarships */}
        <ScholarshipSection
          universityId={university.id}
          country={university.country}
          locale={locale}
        />

        {/* Action links */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <BookmarkButton
            type="university"
            id={university.id}
            initialSaved={isSaved}
            locale={locale}
            size="detail"
          />
          <a
            href={university.official_website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-5 py-3 border-2 border-primary text-primary rounded-lg text-sm font-semibold text-center hover:bg-primary hover:text-primary-foreground transition-colors"
            aria-label={`${t('website')} (opens in new tab)`}
          >
            {t('website')} ↗
          </a>
          <a
            href={university.application_portal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-5 py-3 bg-gold text-white rounded-lg text-sm font-semibold text-center hover:bg-gold-dark transition-colors shadow-sm"
            aria-label={`${t('apply')} (opens in new tab)`}
          >
            {t('apply')} ↗
          </a>
        </div>
      </div>
    </>
  );
}
