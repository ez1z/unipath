'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { trackEvent } from '@/lib/analytics/track';

type Props = {
  type: 'university' | 'scholarship';
  id: string;
  slug: string;
  country?: string;
  city?: string;
};

// Records a single university/scholarship view. Mounted on the detail pages,
// separate from the pageview tracker so pageviews are never double-counted.
export function EntityViewTracker({ type, id, slug, country, city }: Props) {
  const locale = useLocale();
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (fired.current === id) return;
    fired.current = id;
    trackEvent({
      event_type: type === 'university' ? 'university_view' : 'scholarship_view',
      entity_id: id,
      entity_slug: slug,
      country,
      city,
      locale,
    });
  }, [type, id, slug, country, city, locale]);

  return null;
}
