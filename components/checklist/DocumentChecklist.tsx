'use client';

import { useTranslations } from 'next-intl';
import { useDocsState } from '@/lib/docs/useDocsState';
import { docsProgress, resolveDocs, type Translate } from '@/lib/docs/resolve';
import { MAX_CUSTOM_DOCS, type DocsDiffMap } from '@/lib/docs/types';
import { DocsChecklist } from '@/components/docs/DocsChecklist';

type Props = {
  universityId: string;
  locale: string;
  isSignedIn: boolean;
  entranceRequirements: Record<string, unknown>;
  /**
   * Passed whole rather than as this university's diff alone: `getDocsDiffs`
   * omits universities with no stored progress, and that absence is what tells
   * the hook a guest's local copy is safe to adopt.
   */
  initialDiffs: DocsDiffMap;
};

/**
 * The university page's copy of the checklist.
 *
 * It renders the same `DocsChecklist` as the list drawer over the same
 * `useDocsState` hook, so the two surfaces cannot disagree about what is on the
 * list or what has been ticked. Signed-out students get a working checklist
 * here too — their progress lives in localStorage until they sign in, at which
 * point the hook adopts it.
 */
export function DocumentChecklist({
  universityId,
  locale,
  isSignedIn,
  entranceRequirements,
  initialDiffs,
}: Props) {
  const t = useTranslations('checklist');
  const tDocs = t as unknown as Translate;

  const docs = useDocsState({ locale, isSignedIn, initial: initialDiffs });

  const items = resolveDocs(entranceRequirements, docs.diffOf(universityId), tDocs);
  const { total, checked } = docsProgress(items);
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-base text-foreground">{t('title')}</h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t('progress', { checked, total })}
        </span>
      </div>

      <div
        className="w-full bg-secondary rounded-full h-2 mb-5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progress', { checked, total })}
      >
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            pct === 100 ? 'bg-tk-green' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <DocsChecklist
        items={items}
        atLimit={docs.diffOf(universityId).custom.length >= MAX_CUSTOM_DOCS}
        onToggle={(itemId, next) => docs.toggle(universityId, itemId, next)}
        onAdd={(name) => docs.add(universityId, name)}
        onRemove={(itemId) => docs.remove(universityId, itemId)}
      />

      {docs.saveState === 'error' && (
        <p className="text-sm font-medium text-crimson mt-3">{t('save_failed')}</p>
      )}
    </div>
  );
}
