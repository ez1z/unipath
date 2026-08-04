import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { University } from '@/lib/data/university-types';
import type { Locale } from '@/lib/constants';
import { getNearestDeadline, deadlineBadgeCls } from '@/lib/data/deadline';
import { formatDate } from '@/lib/format';
import { docsProgress, resolveDocs, type Translate } from '@/lib/docs/resolve';
import { EMPTY_DIFF, type DocsDiffMap } from '@/lib/docs/types';

type Props = {
  dreamUniversities: University[];
  docsDiffs: DocsDiffMap;
  locale: Locale;
};

export async function ProfileChecklistSummary({
  dreamUniversities,
  docsDiffs,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: 'checklist' });
  const tUni = await getTranslations({ locale, namespace: 'university' });
  const tDocs = t as unknown as Translate;

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
            // Derived rather than stored, so a university the student has never
            // opened still shows a real denominator instead of a dash.
            const { total, checked } = docsProgress(
              resolveDocs(uni.entrance_requirements, docsDiffs[uni.id] ?? EMPTY_DIFF, tDocs),
            );
            const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
            const nearest = getNearestDeadline(uni.semesters);

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

                {nearest && (
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {t('next_deadline')}: {nearest.semester.name} ·{' '}
                      {formatDate(new Date(nearest.semester.deadline!))}
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${deadlineBadgeCls(nearest.days)}`}
                    >
                      {nearest.days < 0
                        ? tUni('deadline_passed')
                        : nearest.days === 0
                          ? tUni('deadline_today')
                          : tUni('deadline_days_left', { days: nearest.days })}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
