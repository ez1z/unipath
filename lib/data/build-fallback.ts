// If Supabase is down or restricted during `next build`, prerender a page with
// empty data instead of failing the whole deploy (same approach as the home
// page). ISR refills it once the catalog loads again. Outside the build,
// errors still surface.
export async function orEmptyAtBuild<T>(label: string, load: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw err;
    console.warn(`${label}: catalog unavailable at build time, prerendering empty.`, err);
    return empty;
  }
}
