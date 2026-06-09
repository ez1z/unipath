'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Semester } from '@/lib/types/semester';

const PRESET_NAMES = ['Fall', 'Spring', 'Summer', 'Winter'];

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-shadow';

export function SemesterEditor({ defaultValue = [] }: { defaultValue?: Semester[] }) {
  const t = useTranslations('admin');
  const [semesters, setSemesters] = useState<Semester[]>(defaultValue);

  function add() {
    setSemesters((prev) => [...prev, { name: '', start_date: '', deadline: null }]);
  }

  function remove(i: number) {
    setSemesters((prev) => prev.filter((_, idx) => idx !== i));
  }

  function update<K extends keyof Semester>(i: number, field: K, value: Semester[K]) {
    setSemesters((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="semesters" value={JSON.stringify(semesters)} />

      {semesters.length === 0 && (
        <p className="text-sm text-muted-foreground italic">{t('semester_empty')}</p>
      )}

      {semesters.map((sem, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                {PRESET_NAMES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => update(i, 'name', n)}
                    className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                      sem.name === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={sem.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder={t('semester_name_placeholder')}
                aria-label={t('semester_remove_label', { n: i + 1 })}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t('semester_remove_label', { n: i + 1 })}
              className="mt-6 text-xl leading-none text-muted-foreground hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('semester_starts_label')}
              </label>
              <input
                type="date"
                value={sem.start_date}
                onChange={(e) => update(i, 'start_date', e.target.value)}
                aria-label={`Semester ${i + 1} start date`}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('semester_deadline_label')}{' '}
                <span className="font-normal">{t('optional')}</span>
              </label>
              <input
                type="date"
                value={sem.deadline ?? ''}
                onChange={(e) => update(i, 'deadline', e.target.value || null)}
                aria-label={`Semester ${i + 1} application deadline`}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-primary hover:underline"
      >
        {t('semester_add')}
      </button>
    </div>
  );
}
