import { useTranslations } from 'next-intl';
import type { Scholarship } from '@/lib/data/scholarships';
import { TMT_PER_USD } from '@/lib/constants';
import type { Locale } from '@/lib/constants';

type Props = {
  scholarship: Scholarship;
  locale: Locale;
  universityName?: string;
  compact?: boolean;
};

const TYPE_STYLES: Record<string, string> = {
  government: 'bg-gold/10 text-gold-dark border-gold/40',
  merit: 'bg-primary/10 text-primary border-primary/30',
  'need-based': 'bg-tk-green/10 text-tk-green border-tk-green/30',
  partial: 'bg-secondary text-secondary-foreground border-border',
};

export function ScholarshipCard({ scholarship: s, locale, universityName, compact = false }: Props) {
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
      className="bg-card rounded-xl border border-border border-l-[3px] border-l-tk-green shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col gap-3 p-5"
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className={`font-heading font-semibold leading-snug text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
            {name}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 ${TYPE_STYLES[s.type] ?? TYPE_STYLES.partial}`}
          >
            {typeLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{uniLine}</p>
      </div>

      {/* Coverage pills */}
      {s.coverage.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {s.coverage.map((item) => (
            <span
              key={item}
              className="px-2 py-0.5 bg-tk-green/10 text-tk-green border border-tk-green/25 rounded text-xs font-medium"
            >
              {COVERAGE_LABELS[item] ?? item}
            </span>
          ))}
        </div>
      )}

      {/* Amount + deadline */}
      {!compact && (
        <div className="flex gap-4 text-sm">
          {s.amount_usd !== null && (
            <div>
              <span className="text-muted-foreground text-xs block uppercase tracking-wide mb-0.5">
                {t('amount_label')}
              </span>
              <span className="font-semibold text-foreground">
                ${s.amount_usd.toLocaleString('en')} / {(s.amount_usd * TMT_PER_USD).toLocaleString('ru')} TMT
              </span>
            </div>
          )}
          {s.deadline_text && (
            <div>
              <span className="text-muted-foreground text-xs block uppercase tracking-wide mb-0.5">
                {t('deadline_label')}
              </span>
              <span className="font-semibold text-foreground">{s.deadline_text}</span>
            </div>
          )}
        </div>
      )}

      {/* Compact: inline deadline */}
      {compact && s.deadline_text && (
        <p className="text-xs text-muted-foreground">
          {t('deadline_label')}: <span className="font-medium text-foreground">{s.deadline_text}</span>
        </p>
      )}

      {/* Apply link */}
      {s.application_url && (
        <a
          href={s.application_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto text-sm font-semibold text-tk-green hover:text-tk-green/80 transition-colors"
          aria-label={`${t('apply')}: ${name} (opens in new tab)`}
        >
          {t('apply')} ↗
        </a>
      )}
    </div>
  );
}
