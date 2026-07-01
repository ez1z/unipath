import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getRecentFeed } from '@/lib/data/discussions';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { DiscussionSection } from '@/components/discussion/DiscussionSection';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function DiscussionsFeedPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('discussions');
  const feed = await getRecentFeed(locale);

  return (
    <>
      <PageHeader title={t('feed_title')} subtitle={t('feed_subtitle')} />
      <div className="container mx-auto px-5 py-8 max-w-3xl space-y-10">
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground mb-4">{t('general_title')}</h2>
          <DiscussionSection locale={locale} entityType="general" entityId={null} />
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground mb-4">{t('activity_title')}</h2>
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('feed_empty')}</p>
          ) : (
            <ul className="space-y-3">
              {feed.map((item) => {
                const href =
                  item.entityType === 'university'
                    ? `/${locale}/universities/${item.entitySlug}/discussion`
                    : `/${locale}/scholarships/${item.entitySlug}/discussion`;
                return (
                  <li key={item.id}>
                    <Link
                      href={href}
                      className="block bg-card border border-border rounded-xl p-4 hover:shadow-card transition-shadow"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-primary truncate">{item.entityName}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDate(new Date(item.createdAt))}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap break-words">
                        {item.body}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{item.authorLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t('score_label', { score: item.score })}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
