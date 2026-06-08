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
import { DocumentChecklist } from '@/components/checklist/DocumentChecklist';
import { createClient } from '@/lib/supabase/server';
import { getOrInitChecklist } from '@/lib/data/checklist';
import type { Locale } from '@/lib/constants';
import type { Semester } from '@/lib/types/semester';

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

  const checklistItems = user
    ? await getOrInitChecklist(university.id, locale)
    : [];

  const t = await getTranslations('university');
  const tCommon = await getTranslations('common');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function daysUntil(iso: string) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
  }

  function deadlineBadge(days: number) {
    if (days < 0) return { text: t('deadline_passed'), cls: 'bg-muted text-muted-foreground' };
    if (days === 0) return { text: t('deadline_today'), cls: 'bg-red-50 text-red-600' };
    if (days <= 14) return { text: t('deadline_days_left', { days }), cls: 'bg-red-50 text-red-600' };
    if (days <= 30) return { text: t('deadline_days_left', { days }), cls: 'bg-orange-50 text-orange-600' };
    if (days <= 60) return { text: t('deadline_days_left', { days }), cls: 'bg-yellow-50 text-yellow-700' };
    return { text: t('deadline_days_left', { days }), cls: 'bg-green-50 text-green-700' };
  }

  function deadlineLeftBorder(days: number) {
    if (days < 0) return 'border-l-muted-foreground/30';
    if (days <= 14) return 'border-l-red-500';
    if (days <= 30) return 'border-l-orange-400';
    if (days <= 60) return 'border-l-yellow-500';
    return 'border-l-green-500';
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  }
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

        {/* Semesters */}
        {university.semesters.length > 0 && (
          <section className="mb-8">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              {t('semesters_title')}
            </h2>
            <div className="space-y-3">
              {university.semesters.map((sem: Semester, i: number) => {
                const deadlineDays = sem.deadline ? daysUntil(sem.deadline) : null;
                const badge = deadlineDays !== null ? deadlineBadge(deadlineDays) : null;
                const leftBorder = deadlineDays !== null ? deadlineLeftBorder(deadlineDays) : 'border-l-border';
                return (
                  <div key={i} className={`bg-card border border-border border-l-4 ${leftBorder} rounded-xl px-5 py-4`}>
                    <p className="font-semibold text-foreground text-sm mb-2">{sem.name}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                      <div className="flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted-foreground">
                          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="text-xs text-muted-foreground">{t('semester_starts')}:</span>
                        <span className="font-medium text-foreground">{formatDate(sem.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted-foreground">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span className="text-xs text-muted-foreground">{t('semester_deadline')}:</span>
                        {sem.deadline ? (
                          <span className="font-medium text-foreground">{formatDate(sem.deadline)}</span>
                        ) : (
                          <span className="text-muted-foreground italic">{t('semester_no_deadline')}</span>
                        )}
                        {badge && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Document checklist (auth'd users only) */}
        {user && (
          <section className="mb-8">
            <DocumentChecklist
              universityId={university.id}
              initialItems={checklistItems}
            />
          </section>
        )}

        {/* Scholarships */}
        <ScholarshipSection
          universityId={university.id}
          country={university.country}
          locale={locale}
        />

        {/* Data accuracy notice */}
        <div className="flex gap-2.5 items-start rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 mb-4 text-sm text-foreground/70">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-gold" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{tCommon('data_disclaimer')}</p>
        </div>

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
