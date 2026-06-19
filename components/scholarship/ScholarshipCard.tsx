import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Scholarship } from '@/lib/data/scholarships';
import { formatTuitionRange } from '@/lib/format';
import type { Locale } from '@/lib/constants';

type Props = {
  scholarship: Scholarship;
  locale: Locale;
  universityName?: string;
  compact?: boolean;
  bookmarkSlot?: React.ReactNode;
};

const TYPE_STYLES: Record<string, string> = {
  government: 'bg-gold/10 text-gold-dark border-gold/30',
  merit: 'bg-primary/10 text-primary border-primary/25',
  'need-based': 'bg-tk-green/10 text-tk-green border-tk-green/25',
  partial: 'bg-secondary text-secondary-foreground border-border',
};

export function ScholarshipCard({ scholarship: s, locale, universityName, compact = false, bookmarkSlot }: Props) {
  const t = useTranslations('scholarships');
  const name = s.name[locale] ?? s.name.en;

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

  const typeLabel = TYPE_LABELS[s.type] ?? s.type;
  const uniLine = universityName
    ? universityName
    : t('all_universities_in', { country: s.country });

  return (
    <div
      data-testid="scholarship-card"
      className="relative bg-white rounded-2xl border border-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col group overflow-hidden"
    >
      <Link
        href={`/${locale}/scholarships/${s.slug}`}
        className="absolute inset-0 z-0"
        aria-label={name}
      />

      <div className="p-5 pb-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className={`font-heading font-semibold leading-snug text-foreground group-hover:text-primary transition-colors ${compact ? 'text-sm' : 'text-[15px]'}`}>
              {name}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${TYPE_STYLES[s.type] ?? TYPE_STYLES.partial}`}>
                {typeLabel}
              </span>
              {bookmarkSlot}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{uniLine}</p>
        </div>

        {/* Coverage pills */}
        {s.coverage.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {s.coverage.map((item) => (
              <span
                key={item}
                className="px-2 py-0.5 bg-tk-green/10 text-tk-green border border-tk-green/20 rounded text-xs font-medium"
              >
                {COVERAGE_LABELS[item] ?? item}
              </span>
            ))}
          </div>
        )}

        {/* Amount + deadline */}
        {!compact && (
          <div className="flex gap-4 text-sm mt-auto">
            {s.amount_usd !== null && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block mb-1">
                  {t('amount_label')}
                </span>
                <span className="font-semibold text-foreground">
                  {formatTuitionRange(s.amount_usd, s.amount_usd_max)}
                </span>
              </div>
            )}
            {s.deadline_text && (
              <div className={s.amount_usd !== null ? 'border-l border-border pl-4' : ''}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block mb-1">
                  {t('deadline_label')}
                </span>
                <span className="font-semibold text-foreground">{s.deadline_text}</span>
              </div>
            )}
          </div>
        )}

        {compact && s.deadline_text && (
          <p className="text-xs text-muted-foreground mt-auto">
            {t('deadline_label')}: <span className="font-medium text-foreground">{s.deadline_text}</span>
          </p>
        )}
      </div>

      {/* Footer strip */}
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground group-hover:text-tk-green transition-colors">
          {s.application_url ? `${t('apply')} ↗` : '→'}
        </span>
      </div>
    </div>
  );
}
