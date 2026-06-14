'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TuitionOption } from '@/lib/types/tuition';

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-shadow';

type Props = { defaultValue?: TuitionOption[] };

export function TuitionOptionsEditor({ defaultValue = [] }: Props) {
  const t = useTranslations('admin');
  const [options, setOptions] = useState<TuitionOption[]>(defaultValue);

  function add() {
    setOptions((prev) => [
      ...prev,
      { semester: null, language: null, major: null, amount_usd: 0, note: null },
    ]);
  }

  function remove(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function update<K extends keyof TuitionOption>(i: number, field: K, value: TuitionOption[K]) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  }

  // Serialise for the form action. Empty strings become null so unset
  // dimensions mean "applies regardless of this variable".
  const serialised = options.map((o) => ({
    semester: o.semester?.trim() || null,
    language: o.language?.trim() || null,
    major: o.major?.trim() || null,
    amount_usd: Number(o.amount_usd) || 0,
    note: o.note?.trim() || null,
  }));

  return (
    <div className="space-y-3">
      <input type="hidden" name="tuition_options" value={JSON.stringify(serialised)} />

      {options.length === 0 && (
        <p className="text-sm text-muted-foreground italic">{t('tuition_opt_empty')}</p>
      )}

      {options.map((opt, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('tuition_opt_semester')}
                </label>
                <input
                  type="text"
                  value={opt.semester ?? ''}
                  onChange={(e) => update(i, 'semester', e.target.value || null)}
                  placeholder="Fall"
                  aria-label={`Tuition option ${i + 1} semester`}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('tuition_opt_language')}
                </label>
                <input
                  type="text"
                  value={opt.language ?? ''}
                  onChange={(e) => update(i, 'language', e.target.value || null)}
                  placeholder="English"
                  aria-label={`Tuition option ${i + 1} language`}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {t('tuition_opt_major')}
                </label>
                <input
                  type="text"
                  value={opt.major ?? ''}
                  onChange={(e) => update(i, 'major', e.target.value || null)}
                  placeholder="Engineering"
                  aria-label={`Tuition option ${i + 1} major`}
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t('tuition_opt_remove_label', { n: i + 1 })}
              className="mt-6 text-xl leading-none text-muted-foreground hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('tuition_opt_amount')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={Number.isFinite(opt.amount_usd) ? opt.amount_usd : 0}
                onChange={(e) => update(i, 'amount_usd', Number(e.target.value))}
                placeholder="5000"
                aria-label={`Tuition option ${i + 1} amount in USD`}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('tuition_opt_note')} <span className="font-normal">{t('optional')}</span>
              </label>
              <input
                type="text"
                value={opt.note ?? ''}
                onChange={(e) => update(i, 'note', e.target.value || null)}
                aria-label={`Tuition option ${i + 1} note`}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="text-sm font-medium text-primary hover:underline">
        {t('tuition_opt_add')}
      </button>
    </div>
  );
}
