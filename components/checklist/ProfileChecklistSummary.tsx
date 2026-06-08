import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { University } from '@/lib/data/university-types';
import type { Locale } from '@/lib/constants';
import type { Semester } from '@/lib/types/semester';

type Props = {
  dreamUniversities: University[];
  checklistProgress: Record<string, { total: number; checked: number }>;
  locale: Locale;
};

function getNearestDeadline(semesters: Semester[]): { semester: Semester; days: number } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withDeadlines = semesters
    .filter((s) => s.deadline)
    .map((s) => {
      const d = new Date(s.deadline!);
      d.setHours(0, 0, 0, 0);
      return { semester: s, days: Math.ceil((d.getTime() - today.getTime()) / 86_400_000) };
    });

  if (withDeadlines.length === 0) return null;

  const upcoming = withDeadlines.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);
  if (upcoming.length > 0) return upcoming[0];

  return withDeadlines.sort((a, b) => b.days - a.days)[0];
}

function deadlineBadgeCls(days: number): string {
  if (days < 0) return 'bg-muted text-muted-foreground';
  if (days <= 14) return 'bg-red-50 text-red-600';
  if (days <= 30) return 'bg-orange-50 text-orange-600';
  if (days <= 60) return 'bg-yellow-50 text-yellow-700';
  return 'bg-green-50 text-green-700';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export async function ProfileChecklistSummary({
  dreamUniversities,
  checklistProgress,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: 'checklist' });
  const tUni = await getTranslations({ locale, namespace: 'university' });

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
                      {t('next_deadline')}: {nearest.semester.name} · {formatDate(nearest.semester.deadline!)}
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
