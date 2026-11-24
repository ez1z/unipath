import { unstable_cache } from 'next/cache';

// Calling this inside a render lowers the page's ISR interval to a minute
// (Next keeps the shortest revalidate seen during the render).
const retrySoon = unstable_cache(async () => true, ['build-fallback-retry-soon'], { revalidate: 60 });

// If Supabase is down or restricted during `next build`, prerender a page with
// empty data instead of failing the whole deploy (same approach as the home
// page). The empty page is cached for only a minute, so the first visit after
// that regenerates it from the catalog. Outside the build, errors still surface.
export async function orEmptyAtBuild<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw err;
    console.warn(`${label}: catalog unavailable at build time, prerendering empty.`, err);
    await retrySoon();
    return empty;
  }
}
