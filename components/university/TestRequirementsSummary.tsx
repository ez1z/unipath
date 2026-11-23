import { useTranslations } from 'next-intl';
import { getTestEntries, type TestEntry } from '@/lib/data/fit';
import { summarizeTests, testLabelText } from '@/lib/data/test-labels';

export { getTestEntries };

type SummaryItem = { key: string; text: string };

function buildItems(tests: TestEntry[], t: ReturnType<typeof useTranslations>): SummaryItem[] {
  const tr = (key: string) => t(key as Parameters<typeof t>[0]);
  return summarizeTests(tests, (d) => testLabelText(d, tr)).map((text, i) => ({ key: `${i}-${text}`, text }));
}

type Props = {
  requirements: Record<string, unknown> | null | undefined;
  /** 'card' — bordered summary block for detail pages; 'inline' — compact line for list cards. */
  variant?: 'card' | 'inline';
  /** Inline variant only: show the "Min. test scores" caption above the values. */
  showLabel?: boolean;
};

export function TestRequirementsSummary({ requirements, variant = 'card', showLabel = true }: Props) {
  const t = useTranslations('university');
  const tests = getTestEntries(requirements);
  if (tests.length === 0) return null;
  const items = buildItems(tests, t);
  if (items.length === 0) return null;

  if (variant === 'inline') {
    return (
      <div className="text-sm">
        {showLabel && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block mb-1">
            {t('test_summary_label')}
          </span>
        )}
        <span className="font-semibold text-foreground">{items.map((i) => i.text).join(' · ')}</span>
      </div>
    );
  }

  return (
    <section className="mb-8">
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2.5">
          {t('test_summary_label')}
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span
              key={i.key}
              className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-sm font-semibold"
            >
              {i.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
