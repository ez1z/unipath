import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * A Supabase client that never reads cookies, for public data (universities,
 * scholarships, discussion counts).
 *
 * The cookie-based server client calls `cookies()`, which makes every page that
 * uses it render on each request. Public reads don't need the visitor's
 * session, because RLS shows the same rows to anon and signed-in users, so
 * using this client lets those pages be cached (ISR) and served without
 * running a function for every visit or crawler hit.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
