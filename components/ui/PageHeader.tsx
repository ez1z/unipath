import { Suspense } from 'react';
import Link from 'next/link';
import { BACK_LINK_CLASS } from './back-link';
import { FilterAwareBackLink } from './FilterAwareBackLink';

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** Restore the list filters from the `from` query param, read on the client. */
  keepListFilters?: boolean;
  badge?: React.ReactNode;
  action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, backHref, backLabel, keepListFilters, badge, action }: Props) {
  const plainBackLink = backHref ? (
    <Link href={backHref} className={BACK_LINK_CLASS}>
      ← {backLabel}
    </Link>
  ) : null;

  return (
    <div className="bg-white border-b border-border">
      <div className="container mx-auto px-5 pt-8 pb-0">
        {backHref && keepListFilters ? (
          <Suspense fallback={plainBackLink}>
            <FilterAwareBackLink href={backHref} label={backLabel} />
          </Suspense>
        ) : (
          plainBackLink
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
        <div className="mt-6 h-px bg-gradient-to-r from-gold/40 via-gold/15 to-transparent" />
      </div>
    </div>
  );
}
