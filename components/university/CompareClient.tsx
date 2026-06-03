'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { University } from '@/lib/data/universities';
import { formatTuition } from '@/lib/format';
import { MoeBadge } from './MoeBadge';
import { Select } from '@/components/ui/Select';
import type { Locale } from '@/lib/constants';

const MAX_COMPARE = 3;

type Props = { universities: University[]; locale: Locale };

export function CompareClient({ universities, locale }: Props) {
  const t = useTranslations('compare');
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
    { label: t('tuition'), key: 'tuition', render: (u) => formatTuition(u.tuition_usd) },
    {
      label: t('ranking'),
      key: 'ranking',
      render: (u) =>
        u.ranking_qs ? (
          <span className="font-semibold text-primary">{t('ranking_value', { rank: u.ranking_qs })}</span>
        ) : (
          <span className="text-muted-foreground">{t('ranking_unranked')}</span>
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
              <tr className="bg-primary">
                <th className="text-left py-4 px-4 font-medium text-primary-foreground/60 w-36" />
                {selected.map((u) => (
                  <th key={u.id} className="text-left py-4 px-4 border-l border-white/10 align-top">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/${locale}/universities/${u.id}`}
                        className="font-heading font-semibold text-primary-foreground hover:text-gold transition-colors"
                      >
                        {u.name[locale] ?? u.name.en}
                      </Link>
                      <button
                        onClick={() => removeUniversity(u.id)}
                        aria-label={`${t('remove')} ${u.name[locale] ?? u.name.en}`}
                        className="text-primary-foreground/50 hover:text-gold text-base leading-none flex-shrink-0 mt-0.5"
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
