import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getBySlug } from '@/lib/data/scholarships';
import { getById as getUniversityById } from '@/lib/data/universities';
import { TMT_PER_USD } from '@/lib/constants';
import { GulPattern } from '@/components/ui/GulPattern';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale; id: string } };

const TYPE_STYLES: Record<string, string> = {
  government: 'bg-gold/10 text-gold-dark border-gold/40',
  merit: 'bg-primary/10 text-primary border-primary/30',
  'need-based': 'bg-tk-green/10 text-tk-green border-tk-green/30',
  partial: 'bg-secondary text-secondary-foreground border-border',
};

export default async function ScholarshipDetailPage({ params: { locale, id } }: Props) {
  const scholarship = await getBySlug(id);
  if (!scholarship) notFound();

  const t = await getTranslations('scholarships');
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

  const university = scholarship.university_id
    ? await getUniversityById(scholarship.university_id)
    : null;

  const typeLabel = TYPE_LABELS[scholarship.type] ?? scholarship.type;

  return (
    <>
      {/* Hero banner */}
      <div className="bg-primary relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <GulPattern size={180} className="text-gold" />
        </div>
        <div className="container mx-auto px-4 py-10 relative">
          <Link
            href={`/${locale}/scholarships`}
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/60 hover:text-gold transition-colors mb-5"
          >
            ← {t('title')}
          </Link>
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-primary-foreground leading-tight">
              {name}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border mt-1 flex-shrink-0 ${TYPE_STYLES[scholarship.type] ?? TYPE_STYLES.partial}`}
            >
              {typeLabel}
            </span>
          </div>
          <p className="text-primary-foreground/60 mt-1">{scholarship.country}</p>
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

        {/* Coverage */}
        {scholarship.coverage.length > 0 && (
          <section className="mb-6">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              What it covers
            </h2>
            <div className="flex gap-2 flex-wrap">
              {scholarship.coverage.map((item) => (
                <span
                  key={item}
                  className="px-3 py-1 bg-tk-green/10 text-tk-green border border-tk-green/30 rounded-full text-sm font-medium"
                >
                  {COVERAGE_LABELS[item] ?? item}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {description && (
          <section className="mb-6">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              About
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{description}</p>
          </section>
        )}

        {/* Linked university */}
        {university && (
          <section className="mb-8">
            <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
              University
            </h2>
            <Link
              href={`/${locale}/universities/${university.slug}`}
              className="inline-flex items-center gap-2 bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-card transition-shadow"
            >
              <div>
                <div className="font-semibold text-foreground text-sm">
                  {university.name[locale] ?? university.name.en}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {university.city}, {university.country}
                </div>
              </div>
              <span className="ml-auto text-muted-foreground text-sm">→</span>
            </Link>
          </section>
        )}

        {/* Apply button */}
        {scholarship.application_url && (
          <div className="pt-4 border-t border-border">
            <a
              href={scholarship.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto px-8 py-3 bg-tk-green text-white rounded-lg text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm justify-center"
              aria-label={`${t('apply')} (opens in new tab)`}
            >
              {t('apply')} ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
