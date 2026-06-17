'use client';

import { useState, useEffect } from 'react';
import type { Semester } from '@/lib/types/semester';

const PRESET_NAMES = ['Fall', 'Spring', 'Summer', 'Winter'];

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-shadow';

type Props = {
  defaultValue?: Semester[];
  onChange?: (semesters: Semester[]) => void;
  languages?: string[];
  majors?: string[];
};

function DimensionSelect({
  label,
  value,
  list,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  list: string[];
  onChange: (v: string | null) => void;
}) {
  const current = value ?? '';
  const opts = [...new Set(list.filter(Boolean))];
  if (current && !opts.includes(current)) opts.push(current);

  if (opts.length === 0) return null;

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label}
        className={inputCls}
      >
        <option value="">{"Any"}</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function SemesterEditor({ defaultValue = [], onChange, languages = [], majors = [] }: Props) {
  const [semesters, setSemesters] = useState<Semester[]>(defaultValue);

  useEffect(() => {
    onChange?.(semesters);
  }, [semesters]);

  function add() {
    setSemesters((prev) => [...prev, { name: '', start_date: '', deadline: null, language: null, major: null }]);
  }

  function remove(i: number) {
    setSemesters((prev) => prev.filter((_, idx) => idx !== i));
  }

  function update<K extends keyof Semester>(i: number, field: K, value: Semester[K]) {
    setSemesters((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  }

  const hasDimensions = languages.length > 0 || majors.length > 0;

  return (
    <div className="space-y-3">
      <input type="hidden" name="semesters" value={JSON.stringify(semesters)} />

      {semesters.length === 0 && (
        <p className="text-sm text-muted-foreground italic">{"No semesters added yet."}</p>
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
                placeholder={"Semester name (e.g. Fall 2025)"}
                aria-label={`Semester ${i + 1} name`}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove semester ${i + 1}`}
              className="mt-6 text-xl leading-none text-muted-foreground hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {"Course starts *"}
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
                {"Application deadline"}{' '}
                <span className="font-normal">{"(optional)"}</span>
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

          {hasDimensions && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
              <DimensionSelect
                label={"Applies to language"}
                value={sem.language}
                list={languages}
                onChange={(v) => update(i, 'language', v)}
              />
              <DimensionSelect
                label={"Applies to major"}
                value={sem.major}
                list={majors}
                onChange={(v) => update(i, 'major', v)}
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-primary hover:underline"
      >
        {"+ Add semester"}
      </button>
    </div>
  );
}
