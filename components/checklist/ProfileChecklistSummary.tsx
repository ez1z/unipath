import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { University } from '@/lib/data/university-types';
import type { Locale } from '@/lib/constants';

type Props = {
  dreamUniversities: University[];
  checklistProgress: Record<string, { total: number; checked: number }>;
  locale: Locale;
};

export async function ProfileChecklistSummary({
  dreamUniversities,
  checklistProgress,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: 'checklist' });

  return (
    <section className="mt-8 border-t border-border pt-8">
      <h2 className="font-heading font-semibold text-lg text-foreground mb-1">
        {t('profile_section_title')}
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        {t('profile_section_subtitle')}
      </p>

      {dreamUniversities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('no_items_hint')}</p>
      ) : (
        <ul className="space-y-3">
          {dreamUniversities.map((uni) => {
            const name = uni.name[locale] ?? uni.name.en;
            const progress = checklistProgress[uni.id];
            const total = progress?.total ?? 0;
            const checked = progress?.checked ?? 0;
            const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

            return (
              <li
                key={uni.id}
                className="bg-card border border-border rounded-xl p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="font-medium text-sm text-foreground">
                      {name}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {uni.city}, {uni.country}
                    </span>
                  </div>
                  <Link
                    href={`/${locale}/universities/${uni.slug}`}
                    className="flex-shrink-0 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    {t('view_checklist')} →
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 bg-secondary rounded-full h-1.5"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct === 100 ? 'bg-tk-green' : 'bg-primary'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {total > 0 ? t('progress', { checked, total }) : '—'}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
