'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { University } from '@/lib/data/universities';
import { computeTuitionBreakdown, formatRange, formatUsd, formatTmt, formatOldManatRange, formatPercentRange } from '@/lib/format';
import { MoeBadge } from './MoeBadge';
import { TestRequirementsSummary, getTestEntries } from './TestRequirementsSummary';
import { Select } from '@/components/ui/Select';
import type { Locale } from '@/lib/constants';

const MAX_COMPARE = 3;

type Props = { universities: University[]; locale: Locale };

export function CompareClient({ universities, locale }: Props) {
  const t = useTranslations('compare');
  const tUni = useTranslations('university');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialIds = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_COMPARE);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [addValue, setAddValue] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedIds.length) params.set('ids', selectedIds.join(','));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [selectedIds, router]);

  const selected = selectedIds
    .map((id) => universities.find((u) => u.id === id))
    .filter(Boolean) as University[];

  const available = universities.filter((u) => !selectedIds.includes(u.id));

  function addUniversity(id: string) {
    if (!id || selectedIds.length >= MAX_COMPARE) return;
    setSelectedIds((prev) => [...prev, id]);
    setAddValue('');
  }

  function removeUniversity(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  const addOptions = [
    { value: '', label: t('select_placeholder'), muted: true },
    ...available.map((u) => ({
      value: u.id,
      label: `${u.name[locale] ?? u.name.en} — ${u.country}`,
    })),
  ];

  const rows: { label: string; key: string; render: (u: University) => React.ReactNode }[] = [
    {
      label: t('tuition'),
      key: 'tuition',
      render: (u) => {
        const bdMin = computeTuitionBreakdown(u.tuition_usd);
        const hasRange = u.tuition_usd_max != null && u.tuition_usd_max > u.tuition_usd;
        const bdMax = hasRange ? computeTuitionBreakdown(u.tuition_usd_max as number) : null;
        const bd = bdMax ?? bdMin;
        const oldManatText = formatOldManatRange(bdMin, bdMax, {
          billion: tUni('billion_word'),
          million: tUni('million_word'),
          thousand: tUni('thousand_word'),
        });
        return (
          <div className="space-y-0.5">
            <div className="font-semibold text-foreground">{formatRange(u.tuition_usd, u.tuition_usd_max, formatUsd)}</div>
            {bd.exceedsCap ? (
              <div className="text-xs">
                <span className="text-gold-dark">{formatRange(bdMin.officialTmt, bdMax?.officialTmt, formatTmt)}</span>
                {' + '}
                <span className="text-crimson">{formatRange(bdMin.unofficialTmt, bdMax?.unofficialTmt, formatTmt)}</span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">{formatRange(bdMin.officialTmt, bdMax?.officialTmt, formatTmt)}</div>
            )}
            <div className="text-xs text-amber-600">{oldManatText}</div>
          </div>
        );
      },
    },
    {
      label: t('ranking'),
      key: 'ranking',
      render: (u) =>
        u.ranking_qs ? (
          <span className="font-semibold text-gold-dark">{t('ranking_value', { rank: u.ranking_qs })}</span>
        ) : (
          <span className="text-muted-foreground">{t('ranking_unranked')}</span>
        ),
    },
    {
      label: t('acceptance_rate'),
      key: 'acceptance',
      render: (u) =>
        u.acceptance_rate_min != null ? (
          <span className="font-semibold text-tk-green">
            {formatPercentRange(u.acceptance_rate_min, u.acceptance_rate_max)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      label: t('test_requirements'),
      key: 'tests',
      render: (u) =>
        getTestEntries(u.entrance_requirements).length > 0 ? (
          <TestRequirementsSummary requirements={u.entrance_requirements} variant="inline" showLabel={false} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      label: t('moe_approved'),
      key: 'moe',
      render: (u) =>
        u.moe_approved ? <MoeBadge /> : <span className="text-muted-foreground text-sm">{t('no')}</span>,
    },
    { label: t('country'), key: 'country', render: (u) => u.country },
    { label: t('city'), key: 'city', render: (u) => u.city },
    {
      label: t('languages'),
      key: 'languages',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.languages.map((l) => (
            <span
              key={l}
              className="px-1.5 py-0.5 bg-gold/10 text-gold-dark border border-gold/25 rounded text-xs font-medium"
            >
              {l.toUpperCase()}
            </span>
          ))}
        </div>
      ),
    },
    {
      label: t('majors'),
      key: 'majors',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.majors.slice(0, 4).map((m) => (
            <span key={m} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">
              {m}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      {selectedIds.length < MAX_COMPARE && (
        <div className="mb-6 max-w-sm">
          <Select
            value={addValue}
            onChange={addUniversity}
            options={addOptions}
            aria-label={t('select_placeholder')}
          />
        </div>
      )}

      {selected.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-base">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-card">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-brand-dark">
                <th className="text-left py-4 px-4 font-medium text-white/30 w-36" />
                {selected.map((u) => (
                  <th key={u.id} className="text-left py-4 px-4 border-l border-white/10 align-top">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/${locale}/universities/${u.slug}`}
                        className="font-heading font-semibold text-white hover:text-gold transition-colors"
                      >
                        {u.name[locale] ?? u.name.en}
                      </Link>
                      <button
                        onClick={() => removeUniversity(u.id)}
                        aria-label={`${t('remove')} ${u.name[locale] ?? u.name.en}`}
                        className="text-white/40 hover:text-gold text-base leading-none flex-shrink-0 mt-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key} className={i % 2 === 0 ? 'bg-card' : 'bg-background'}>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    {row.label}
                  </td>
                  {selected.map((u) => (
                    <td key={u.id} className="py-3.5 px-4 border-l border-border">
                      {row.render(u)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
