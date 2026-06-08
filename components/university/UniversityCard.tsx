import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { University } from '@/lib/data/universities';
import { formatTuition } from '@/lib/format';
import { MoeBadge } from './MoeBadge';
import type { Locale } from '@/lib/constants';

type Props = {
  university: University;
  locale: Locale;
};

export function UniversityCard({ university, locale }: Props) {
  const t = useTranslations('universities');
  const name = university.name[locale] ?? university.name.en;

  return (
    <div data-testid="university-card" className="relative bg-card rounded-xl border border-border border-l-[3px] border-l-primary shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col gap-4 p-5">
      <Link
        href={`/${locale}/universities/${university.slug}`}
        className="absolute inset-0 rounded-xl z-0"
        aria-label={`${t('view_details')}: ${name}`}
      />
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-heading font-semibold text-base leading-snug text-foreground">{name}</h3>
          {university.moe_approved && <MoeBadge />}
        </div>
        <p className="text-sm text-muted-foreground">
          {university.city}, {university.country}
        </p>
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs block uppercase tracking-wide mb-0.5">
            {t('tuition_label')}
          </span>
          <span className="font-semibold text-foreground">{formatTuition(university.tuition_usd)}</span>
        </div>
        {university.ranking_qs && (
          <div>
            <span className="text-muted-foreground text-xs block uppercase tracking-wide mb-0.5">
              {t('ranking')}
            </span>
            <span className="font-semibold text-primary">
              {t('ranking_value', { rank: university.ranking_qs })}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {university.languages.slice(0, 4).map((lang) => (
          <span
            key={lang}
            className="px-2 py-0.5 bg-gold/10 text-gold-dark border border-gold/25 rounded text-xs font-medium"
          >
            {lang.toUpperCase()}
          </span>
        ))}
      </div>

      <span className="mt-auto text-sm font-semibold text-primary">
        {t('view_details')} →
      </span>
    </div>
  );
}
