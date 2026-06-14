'use client';

import { useState } from 'react';
import type { TuitionOption } from '@/lib/types/tuition';

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-shadow';

type Props = {
  defaultValue?: TuitionOption[];
  /** The university's current semester names, languages and majors — the variant
   *  dropdowns are sourced from these so the fields stay connected. */
  semesterNames: string[];
  languages: string[];
  majors: string[];
};

export function TuitionOptionsEditor({ defaultValue = [], semesterNames, languages, majors }: Props) {
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

  // Serialise for the form action. Empty strings become null so an unset
  // dimension means "applies regardless of this variable".
  const serialised = options.map((o) => ({
    semester: o.semester?.trim() || null,
    language: o.language?.trim() || null,
    major: o.major?.trim() || null,
    amount_usd: Number(o.amount_usd) || 0,
    note: o.note?.trim() || null,
  }));

  // Build select options from the live lists, preserving any already-saved value
  // that is no longer in the list so the admin doesn't silently lose it.
  function optionsFor(list: string[], current: string | null): string[] {
    const set = new Set(list.filter(Boolean));
    if (current && !set.has(current)) set.add(current);
    return [...set];
  }

  function DimensionSelect({
    i,
    field,
    label,
    list,
  }: {
    i: number;
    field: 'semester' | 'language' | 'major';
    label: string;
    list: string[];
  }) {
    const current = options[i][field];
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <select
          value={current ?? ''}
          onChange={(e) => update(i, field, e.target.value || null)}
          aria-label={`Tuition variant ${i + 1} ${field}`}
          className={inputCls}
        >
          <option value="">{"Any"}</option>
          {optionsFor(list, current).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const noDimensions = semesterNames.length === 0 && languages.length === 0 && majors.length === 0;

  return (
    <div className="space-y-3">
      <input type="hidden" name="tuition_options" value={JSON.stringify(serialised)} />

      {options.length === 0 && (
        <p className="text-sm text-muted-foreground italic">{"No tuition variants. The annual tuition above applies to all programs. Add a variant only if cost differs by semester, language, or major."}</p>
      )}

      {options.length > 0 && noDimensions && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {"Define semesters, languages or majors above first — tuition variants are built from those."}
        </p>
      )}

      {options.map((opt, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <DimensionSelect i={i} field="semester" label={"Semester"} list={semesterNames} />
              <DimensionSelect i={i} field="language" label={"Language"} list={languages} />
              <DimensionSelect i={i} field="major" label={"Major"} list={majors} />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove tuition variant ${i + 1}`}
              className="mt-6 text-xl leading-none text-muted-foreground hover:text-red-500 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {"Amount (USD) *"}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={Number.isFinite(opt.amount_usd) ? opt.amount_usd : 0}
                onChange={(e) => update(i, 'amount_usd', Number(e.target.value))}
                placeholder="5000"
                aria-label={`Tuition variant ${i + 1} amount in USD`}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {"Note"} <span className="font-normal">{"(optional)"}</span>
              </label>
              <input
                type="text"
                value={opt.note ?? ''}
                onChange={(e) => update(i, 'note', e.target.value || null)}
                aria-label={`Tuition variant ${i + 1} note`}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="text-sm font-medium text-primary hover:underline">
        {"+ Add tuition variant"}
      </button>
    </div>
  );
}
