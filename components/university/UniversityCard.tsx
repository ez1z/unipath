import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { University } from '@/lib/data/universities';
import { computeTuitionBreakdown } from '@/lib/format';
import { MoeBadge } from './MoeBadge';
import type { Locale } from '@/lib/constants';

type Props = {
  university: University;
  locale: Locale;
  bookmarkSlot?: React.ReactNode;
};

export function UniversityCard({ university, locale, bookmarkSlot }: Props) {
  const t = useTranslations('universities');
  const tUni = useTranslations('university');
  const name = university.name[locale] ?? university.name.en;

  const bd = computeTuitionBreakdown(university.tuition_usd);
  const oldManatParts: string[] = [];
  if (bd.billions > 0) oldManatParts.push(`${bd.billions} ${tUni('billion_word')}`);
  if (bd.millions > 0) oldManatParts.push(`${bd.millions} ${tUni('million_word')}`);
  if (bd.thousands > 0) oldManatParts.push(`${bd.thousands} ${tUni('thousand_word')}`);
  const oldManatText = oldManatParts.join(' ') || `< 1 ${tUni('thousand_word')}`;

  return (
    <div data-testid="university-card" className="relative bg-white rounded-2xl border border-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-0 group overflow-hidden">
      <Link
        href={`/${locale}/universities/${university.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`${t('view_details')}: ${name}`}
      />

      <div className="p-5 pb-4 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="font-heading font-semibold text-[15px] leading-snug text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {university.moe_approved && <MoeBadge />}
              {bookmarkSlot}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {university.city}, {university.country}
          </p>
        </div>

        {/* Tuition + Ranking */}
        <div className="flex gap-4 text-sm">
          <div className="min-w-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block mb-1">
              {t('tuition_label')}
            </span>
            <span className="font-semibold text-foreground">${university.tuition_usd.toLocaleString('en')}</span>
            {bd.exceedsCap ? (
              <span className="block text-xs mt-0.5">
                <span className="text-gold-dark">{bd.officialTmt.toLocaleString('ru')} TMT</span>
                {' + '}
                <span className="text-crimson">{bd.unofficialTmt.toLocaleString('ru')} TMT</span>
              </span>
            ) : (
              <span className="block text-xs text-muted-foreground mt-0.5">{bd.officialTmt.toLocaleString('ru')} TMT</span>
            )}
            <span className="block text-xs text-amber-600/80 mt-0.5">{oldManatText}</span>
          </div>
          {university.ranking_qs && (
            <div className="flex-shrink-0 border-l border-border pl-4">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block mb-1">
                {t('ranking')}
              </span>
              <span className="font-semibold text-gold-dark">
                {t('ranking_value', { rank: university.ranking_qs })}
              </span>
            </div>
          )}
        </div>

        {/* Language pills */}
        <div className="flex gap-1.5 flex-wrap mt-auto">
          {university.languages.slice(0, 4).map((lang) => (
            <span
              key={lang}
              className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium"
            >
              {lang.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
          {t('view_details')} →
        </span>
      </div>
    </div>
  );
}
