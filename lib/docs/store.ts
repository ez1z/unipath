import { setDocsAction, importDocsAction } from '@/lib/actions/docs';
import { readGuestDocs, writeGuestDocs } from './guest-store';
import type { DocsDiff, DocsDiffMap } from './types';

/**
 * The same guest/server seam as `ListStore`, kept separate on purpose.
 *
 * Document progress is deliberately independent of list membership — that
 * independence is the whole reason it lives in its own table — so the
 * university page can persist a checklist without ever constructing a list.
 */
export type DocsStore = {
  setDocs(universityId: string, diff: DocsDiff): Promise<void>;
  importAll(diffs: DocsDiffMap): Promise<void>;
};

export function createServerDocsStore(locale: string): DocsStore {
  return {
    // Both of these reject on failure rather than resolving quietly. The hook
    // clears the guest's local copy in `.then()`, so a silent failure here would
    // delete progress that never reached the server.
    async setDocs(universityId, diff) {
      const result = await setDocsAction(locale, universityId, diff);
      if (!result.ok) throw new Error(result.error);
    },
    async importAll(diffs) {
      const result = await importDocsAction(locale, diffs);
      if (!result.ok) throw new Error(result.error);
    },
  };
}

export function createGuestDocsStore(): DocsStore {
  return {
    async setDocs(universityId, diff) {
      writeGuestDocs({ ...readGuestDocs(), [universityId]: diff });
    },
    async importAll() {
      // Guests have nowhere to import to — their storage is already the source.
    },
  };
}
