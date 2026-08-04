import { createClient } from '@/lib/supabase/server';
import { DocsDiffSchema, type DocsDiffMap } from '@/lib/docs/types';

/**
 * Stored document diffs for the given universities, keyed by university id.
 *
 * Universities with no row simply do not appear — an absent diff and an empty
 * one mean the same thing, so callers pass whatever is missing to
 * `resolveDocs()` as `EMPTY_DIFF` and get the untouched template back.
 *
 * Signed-out visitors get `{}`; their progress lives in localStorage and is
 * read after mount by `useDocsState`.
 */
export async function getDocsDiffs(universityIds: string[]): Promise<DocsDiffMap> {
  if (universityIds.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from('document_progress')
    .select('university_id, checked, removed, custom')
    .eq('user_id', user.id)
    .in('university_id', universityIds);

  const diffs: DocsDiffMap = {};
  for (const row of data ?? []) {
    const parsed = DocsDiffSchema.safeParse(row);
    if (parsed.success) diffs[row.university_id as string] = parsed.data;
  }
  return diffs;
}
