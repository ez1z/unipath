import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getBySlug } from '@/lib/data/scholarships';
import { getById as getUniversityById } from '@/lib/data/universities';
import { TMT_PER_USD } from '@/lib/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';
import type { Semester } from '@/lib/types/semester';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale; id: string } };

const TYPE_STYLES: Record<string, string> = {
  government: 'bg-gold/10 text-gold-dark border-gold/40',
  merit: 'bg-primary/10 text-primary border-primary/30',
  'need-based': 'bg-tk-green/10 text-tk-green border-tk-green/30',
  partial: 'bg-secondary text-secondary-foreground border-border',
};

function daysUntil(isoDate: string, today: Date): number {
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function deadlineBadge(days: number, labels: { today: string; passed: string; left: (n: number) => string }) {
  if (days < 0) return { text: labels.passed, cls: 'bg-muted text-muted-foreground' };
  if (days === 0) return { text: labels.today, cls: 'bg-red-50 text-red-600' };
  if (days <= 14) return { text: labels.left(days), cls: 'bg-red-50 text-red-600' };
  if (days <= 30) return { text: labels.left(days), cls: 'bg-orange-50 text-orange-600' };
  if (days <= 60) return { text: labels.left(days), cls: 'bg-yellow-50 text-yellow-700' };
  return { text: labels.left(days), cls: 'bg-green-50 text-green-700' };
}

function deadlineLeftBorder(days: number): string {
  if (days < 0) return 'border-l-muted-foreground/30';
  if (days <= 14) return 'border-l-red-500';
  if (days <= 30) return 'border-l-orange-400';
  if (days <= 60) return 'border-l-yellow-500';
  return 'border-l-green-500';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ScholarshipDetailPage({ params: { locale, id } }: Props) {
  const scholarship = await getBySlug(id);
  if (!scholarship) notFound();

  const t = await getTranslations('scholarships');
  const tCommon = await getTranslations('common');
  const name = scholarship.name[locale] ?? scholarship.name.en;
  const description = scholarship.description[locale] ?? scholarship.description.en;

  const TYPE_LABELS: Record<string, string> = {
    government: t('type_government'),
    merit: t('type_merit'),
    'need-based': t('type_need_based'),
    partial: t('type_partial'),
  };
  const COVERAGE_LABELS: Record<string, string> = {
    tuition: t('coverage_tuition'),
    accommodation: t('coverage_accommodation'),
    flights: t('coverage_flights'),
    stipend: t('coverage_stipend'),
    health: t('coverage_health'),
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isSaved = false;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('interested_scholarship_ids')
      .eq('id', user.id)
      .maybeSingle();
    isSaved = (data?.interested_scholarship_ids ?? []).includes(scholarship.id);
  }

  const university = scholarship.university_id
    ? await getUniversityById(scholarship.university_id)
    : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const badgeLabels = {
    today: t('deadline_today'),
    passed: t('deadline_passed'),
    left: (n: number) => t('deadline_days_left', { days: n }),
  };

  return (
    <>
      <PageHeader
        title={name}
        subtitle={scholarship.country}
        backHref={`/${locale}/scholarships`}
        backLabel={t('title')}
        badge={
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TYPE_STYLES[scholarship.type] ?? TYPE_STYLES.partial}`}>
            {TYPE_LABELS[scholarship.type] ?? scholarship.type}
          </span>
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Key stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border border-t-4 border-t-tk-green rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              {t('amount_label')}
            </div>
            <div className="font-heading font-bold text-lg text-foreground">
              {scholarship.amount_usd !== null
                ? `$${scholarship.amount_usd.toLocaleString('en')} / ${(scholarship.amount_usd * TMT_PER_USD).toLocaleString('ru')} TMT`
                : t('amount_varies')}
            </div>
          </div>
          <div className="bg-card border border-border border-t-4 border-t-gold rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              {t('deadline_label')}
            </div>
            <div className="font-heading font-bold text-lg text-foreground">
              {scholarship.deadline_text ?? '—'}
            </div>
          </div>
        </div>

        {/* Semesters & intake dates */}
        {scholarship.semesters.length > 0 && (
          <section className="mb-8">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              {t('semesters_title')}
            </h2>
            <div className="space-y-3">
              {scholarship.semesters.map((sem: Semester, i: number) => {
                const deadlineDays = sem.deadline ? daysUntil(sem.deadline, today) : null;
                const badge = deadlineDays !== null ? deadlineBadge(deadlineDays, badgeLabels) : null;
                const leftBorder = deadlineDays !== null ? deadlineLeftBorder(deadlineDays) : 'border-l-border';
                return (
                  <div
                    key={i}
                    className={`bg-card border border-border border-l-4 ${leftBorder} rounded-xl px-5 py-4`}
                  >
                    <p className="font-semibold text-foreground text-sm mb-2">{sem.name}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

        {/* Coverage */}
        {scholarship.coverage.length > 0 && (
          <section className="mb-6">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              {t('coverage_section_title')}
            </h2>
            <div className="flex gap-2 flex-wrap">
              {scholarship.coverage.map((item) => (
                <span key={item} className="px-3 py-1 bg-tk-green/10 text-tk-green border border-tk-green/30 rounded-full text-sm font-medium">
                  {COVERAGE_LABELS[item] ?? item}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {description && (
          <section className="mb-6">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">{t('about_section_title')}</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{description}</p>
          </section>
        )}

        {/* Linked university */}
        {university && (
          <section className="mb-8">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">{t('university_section_title')}</h2>
            <Link
              href={`/${locale}/universities/${university.slug}`}
              className="inline-flex items-center gap-2 bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-card transition-shadow"
            >
              <div>
                <div className="font-semibold text-foreground text-sm">{university.name[locale] ?? university.name.en}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{university.city}, {university.country}</div>
              </div>
              <span className="ml-auto text-muted-foreground text-sm">→</span>
            </Link>
          </section>
        )}

        {/* Data accuracy notice */}
        <div className="flex gap-2.5 items-start rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 mb-4 text-sm text-foreground/70">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-gold" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{tCommon('data_disclaimer')}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
          <BookmarkButton type="scholarship" id={scholarship.id} initialSaved={isSaved} locale={locale} size="detail" />
          {scholarship.application_url && (
            <a
              href={scholarship.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto px-8 py-3 bg-tk-green text-white rounded-lg text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm justify-center"
              aria-label={`${t('apply')} (opens in new tab)`}
            >
              {t('apply')} ↗
            </a>
          )}
        </div>
      </div>
    </>
  );
}

