'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { trackEvent, externalReferrer } from '@/lib/analytics/track';

// Fires one pageview per distinct path. Mounted once in the locale layout, so it
// records visits/DAU/MAU across the whole public site.
export function AnalyticsTracker() {
  const pathname = usePathname();
  const locale = useLocale();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackEvent({
      event_type: 'pageview',
      path: pathname,
      locale,
      referrer: externalReferrer(),
    });
  }, [pathname, locale]);

  return null;
}
