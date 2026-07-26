import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getBySlug } from '@/lib/data/universities';
import { canonicalFor, localeAlternates, universityJsonLd, breadcrumbJsonLd, jsonLdScript } from '@/lib/seo';
import { getMessageCount } from '@/lib/data/discussions';
import { formatTuition, formatTuitionRange, computeTuitionBreakdown, formatRange, formatTmt, formatOldManatRange, formatPercentRange } from '@/lib/format';
import { MoeBadge } from '@/components/university/MoeBadge';
import { ScholarshipBadge } from '@/components/university/ScholarshipBadge';
import { EntranceRequirements } from '@/components/university/EntranceRequirements';
import { TestRequirementsSummary } from '@/components/university/TestRequirementsSummary';
import { ScholarshipSection } from '@/components/scholarship/ScholarshipSection';
import { PageHeader } from '@/components/ui/PageHeader';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { DocumentChecklist } from '@/components/checklist/DocumentChecklist';
import { createClient } from '@/lib/supabase/server';
import { EntityViewTracker } from '@/components/analytics/EntityViewTracker';
import { getByUniversity } from '@/lib/data/scholarships';
import { getOrInitChecklist } from '@/lib/data/checklist';
import type { Locale } from '@/lib/constants';
import type { Semester } from '@/lib/types/semester';

type Props = {
  params: { locale: Locale; id: string };
  searchParams: { from?: string };
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale, id } }: Props): Promise<Metadata> {
  const university = await getBySlug(id);
  if (!university) return {};
  const name = university.name[locale] ?? university.name.en;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const title = `${name} — ${university.city}, ${university.country}`;
  const description = t('university_description', { name, city: university.city, country: university.country });
  const path = `/universities/${university.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: canonicalFor(locale, path),
      languages: localeAlternates(path),
    },
    openGraph: { title, description },
  };
}

export default async function UniversityDetailPage({ params: { locale, id }, searchParams }: Props) {
  setRequestLocale(locale);
  const university = await getBySlug(id);
  if (!university) notFound();

  // Rebuild the list URL the user came from so "back" restores their filters.
  const backHref = searchParams.from
    ? `/${locale}/universities?${searchParams.from}`
    : `/${locale}/universities`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isSaved = false;
  let isAdmin = false;
  if (user) {
    const [{ data: profileData }, { data: adminData }] = await Promise.all([
      supabase.from('profiles').select('dream_university_ids').eq('id', user.id).maybeSingle(),
      supabase.from('admins').select('role').eq('user_id', user.id).maybeSingle(),
    ]);
    isSaved = (profileData?.dream_university_ids ?? []).includes(university.id);
    isAdmin = !!adminData;
  }

  const checklistItems = user
    ? await getOrInitChecklist(university.id, locale)
    : [];

  const scholarships = await getByUniversity(university.id, university.country);
  const discussionCount = await getMessageCount('university', university.id);

  const t = await getTranslations('university');
  const tCommon = await getTranslations('common');
  const tDisc = await getTranslations('discussions');
  const tNav = await getTranslations('nav');

  const bdMin = computeTuitionBreakdown(university.tuition_usd);
  const tuitionMax = university.tuition_usd_max;
  const hasTuitionRange = tuitionMax != null && tuitionMax > university.tuition_usd;
  const bdMax = hasTuitionRange ? computeTuitionBreakdown(tuitionMax) : null;
  // Cap-split visibility keys off the upper bound (worst case for transfer planning).
  const bd = bdMax ?? bdMin;
  const oldManatText = formatOldManatRange(bdMin, bdMax, {
    billion: t('billion_word'),
    million: t('million_word'),
    thousand: t('thousand_word'),
  });
  const overageText = formatRange(
    bdMin.overageUsd,
    bdMax?.overageUsd,
    (n) => n.toLocaleString('en'),
  );

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

  const breadcrumb = breadcrumbJsonLd([
    { name: tNav('home'), url: canonicalFor(locale, '') },
    { name: tNav('universities'), url: canonicalFor(locale, '/universities') },
    { name, url: canonicalFor(locale, `/universities/${university.slug}`) },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(universityJsonLd(university, locale)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />
      <EntityViewTracker
        type="university"
        id={university.id}
        slug={university.slug}
        country={university.country}
        city={university.city}
      />
      <PageHeader
        title={name}
        subtitle={`${university.city}, ${university.country}`}
        backHref={backHref}
        backLabel={t('back')}
        badge={
          university.moe_approved || scholarships.length > 0 ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              {university.moe_approved && <MoeBadge />}
              {scholarships.length > 0 && <ScholarshipBadge />}
            </span>
          ) : undefined
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href={`/${locale}/universities/${university.slug}/discussion`}
          className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-5 py-3.5 mb-8 hover:shadow-card transition-shadow group"
        >
          <span className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm font-medium text-foreground">{tDisc('open_link', { count: discussionCount })}</span>
          </span>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true">→</span>
        </Link>

        {/* Key stats */}
        <div className={`grid grid-cols-1 ${university.acceptance_rate_min != null ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 mb-8`}>
          <div className="bg-card border border-border border-t-4 border-t-primary rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t('tuition')}</div>
            <div className="font-heading font-bold text-lg text-foreground">{formatTuitionRange(university.tuition_usd, tuitionMax)}</div>
          </div>
          <div className="bg-card border border-border border-t-4 border-t-gold rounded-xl p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t('ranking')}</div>
            <div className="font-heading font-bold text-lg text-foreground">
              {university.ranking_qs
                ? t('ranking_value', { rank: university.ranking_qs })
                : t('ranking_unranked')}
            </div>
          </div>
          {university.acceptance_rate_min != null && (
            <div className="bg-card border border-border border-t-4 border-t-tk-green rounded-xl p-5 shadow-card">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t('acceptance_rate')}</div>
              <div className="font-heading font-bold text-lg text-foreground">
                {formatPercentRange(university.acceptance_rate_min, university.acceptance_rate_max)}
              </div>
            </div>
          )}
        </div>

        {/* Minimum test scores summary */}
        <TestRequirementsSummary requirements={university.entrance_requirements} />

        {/* TMT breakdown */}
        <section className="mb-8">
          <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
            {t('transfer_breakdown')}
          </h2>

          {bd.exceedsCap && (
            <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-crimson/30 bg-crimson-light/30 px-4 py-3 text-sm text-crimson-dark">
              <span className="font-bold text-base leading-tight shrink-0">!</span>
              <span>{t('transfer_over_cap_note', { overage: overageText })}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {bd.exceedsCap ? (
              <>
                <div className="border-2 border-primary/20 rounded-xl p-4 bg-background flex-1 min-w-[140px]">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">{t('official_portion')}</div>
                  <div className="font-heading font-bold text-lg text-primary">{formatRange(bdMin.officialTmt, bdMax?.officialTmt, formatTmt)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t('official_rate_detail')}</div>
                </div>
                <div className="border-2 border-crimson/20 rounded-xl p-4 bg-crimson-light/30 flex-1 min-w-[140px]">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">{t('unofficial_portion')}</div>
                  <div className="font-heading font-bold text-lg text-crimson">{formatRange(bdMin.unofficialTmt, bdMax?.unofficialTmt, formatTmt)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t('unofficial_rate_detail')}</div>
                </div>
              </>
            ) : (
              <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5 flex-1 min-w-[140px]">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">{t('tmt_equivalent')}</div>
                <div className="font-heading font-bold text-xl text-gold-dark">{formatRange(bdMin.officialTmt, bdMax?.officialTmt, formatTmt)}</div>
              </div>
            )}

            {bd.exceedsCap && (
              <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5 flex-1 min-w-[140px]">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">{t('tmt_total')}</div>
                <div className="font-heading font-bold text-xl text-gold-dark">{formatRange(bdMin.totalTmt, bdMax?.totalTmt, formatTmt)}</div>
              </div>
            )}

            <div className="border-2 border-amber-300/50 rounded-xl p-4 bg-amber-50/40 flex-1 min-w-[140px]">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">{tCommon('old_manat_label')}</div>
              <div className="font-heading font-bold text-lg text-amber-700">{oldManatText}</div>
              <div className="text-xs text-muted-foreground mt-1">{formatRange(bdMin.totalTmt, bdMax?.totalTmt, formatTmt)} × 5 000</div>
            </div>
          </div>
        </section>

        {/* Tuition options (differentiated by semester / language / major) */}
        {university.tuition_options.length > 0 && (
          <section className="mb-8">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-1">
              {t('tuition_options_title')}
            </h2>
            <p className="text-sm text-muted-foreground mb-3">{t('tuition_options_desc')}</p>
            <div className="space-y-2">
              {university.tuition_options.map((opt, i) => {
                const hasDimensions = opt.semester || opt.language || opt.major;
                return (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {opt.semester && (
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
                          {opt.semester}
                        </span>
                      )}
                      {opt.language && (
                        <span className="px-2.5 py-0.5 bg-gold/10 text-gold-dark border border-gold/30 rounded-full text-xs font-medium">
                          {opt.language.toUpperCase()}
                        </span>
                      )}
                      {opt.major && (
                        <span className="px-2.5 py-0.5 bg-secondary text-secondary-foreground border border-border rounded-full text-xs">
                          {opt.major}
                        </span>
                      )}
                      {!hasDimensions && (
                        <span className="text-sm text-muted-foreground">{t('tuition_option_all')}</span>
                      )}
                      {opt.note && (
                        <span className="text-xs text-muted-foreground italic">{opt.note}</span>
                      )}
                    </div>
                    <div className="font-heading font-semibold text-foreground whitespace-nowrap">
                      {formatTuition(opt.amount_usd)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
          scholarships={scholarships}
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
          {isAdmin && (
            <a
              href={`/admin/universities/${university.id}/edit`}
              className="flex-1 px-5 py-3 border-2 border-dashed border-muted-foreground/40 text-muted-foreground rounded-lg text-sm font-semibold text-center hover:border-primary hover:text-primary transition-colors"
              aria-label="Edit in admin panel"
            >
              ✏ Edit
            </a>
          )}
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
