/**
 * After every admin write: public pages show the change on their next view
 * (SPEC: "changes show on the site within seconds, with no rebuild").
 *
 * - `data_version` goes up, so every cached page's key changes (lib/cache.ts).
 * - Catalogue writes also rebuild the search index (names in every language).
 */
import { bumpDataVersion } from '../cache.ts';
import type { Db } from '../db/client.ts';
import { rebuildSearchIndex } from '../db/search-index.ts';

export async function afterAdminWrite(
  db: Db,
  kv: KVNamespace,
  { catalogue }: { catalogue: boolean },
): Promise<void> {
  if (catalogue) await rebuildSearchIndex(db);
  await bumpDataVersion(kv);
}
