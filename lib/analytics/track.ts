// Client-side analytics beacon. Fire-and-forget — never throws, never blocks UI.
// The server (/api/track) manages the visitor cookie; the client only sends event
// data. sendBeacon survives page unload (e.g. navigation right after a click).

export type TrackPayload = {
  event_type: 'pageview' | 'university_view' | 'scholarship_view' | 'search';
  path?: string;
  locale?: string;
  referrer?: string;
  entity_id?: string;
  entity_slug?: string;
  country?: string;
  city?: string;
  search_query?: string;
};

export function trackEvent(payload: TrackPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // swallow — analytics must never break the page
  }
}

// Only count external referrers (drop internal navigation and empty values).
export function externalReferrer(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin) return undefined;
    return document.referrer;
  } catch {
    return undefined;
  }
}
