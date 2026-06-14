'use client';

import { useState, useTransition } from 'react';
import { COVERAGE_ITEMS } from '@/lib/data/scholarship-types';
import { SemesterEditor } from '@/components/admin/SemesterEditor';
import type { Semester } from '@/lib/types/semester';

type UniversityOption = { id: string; name_en: string; country: string };

export type ScholarshipFormDefaults = {
  name_en?: string;
  name_ru?: string;
  name_tk?: string;
  country?: string;
  university_id?: string | null;
  type?: string;
  coverage?: string[];
  amount_usd?: string;
  deadline_text?: string;
  semesters?: Semester[];
  description_en?: string;
  description_ru?: string;
  description_tk?: string;
  application_url?: string;
};

type Props = {
  universities: UniversityOption[];
  defaultValues?: ScholarshipFormDefaults;
  action: (formData: FormData) => Promise<{ error: string } | never>;
  submitLabel: string;
  cancelHref: string;
};

const inputClass =
  'w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow';

const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

export function ScholarshipForm({ universities, defaultValues: d = {}, action, submitLabel, cancelHref }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameLabels = {
    en: 'English name *',
    ru: 'Russian name *',
    tk: 'Turkmen name *',
  } as const;

  const descLabels = {
    en: 'English description',
    ru: 'Russian description',
    tk: 'Turkmen description',
  } as const;

  const coverageLabels: Record<string, string> = {
    tuition: 'Tuition',
    accommodation: 'Accommodation',
    flights: 'Flights',
    stipend: 'Monthly stipend',
    health: 'Health insurance',
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
          {error}
        </p>
      )}

      {/* Names */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{"Names"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['en', 'ru', 'tk'] as const).map((lang) => (
            <div key={lang}>
              <label htmlFor={`name_${lang}`} className={labelClass}>
                {nameLabels[lang]}
              </label>
              <input
                id={`name_${lang}`}
                name={`name_${lang}`}
                type="text"
                required
                disabled={isPending}
                defaultValue={d[`name_${lang}` as 'name_en' | 'name_ru' | 'name_tk']}
                placeholder={lang === 'en' ? 'Türkiye Bursları' : undefined}
                aria-label={`Scholarship name in ${lang}`}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Location & type */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{"Location & type"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="country" className={labelClass}>{"Country *"}</label>
            <input
              id="country"
              name="country"
              type="text"
              required
              disabled={isPending}
              defaultValue={d.country}
              placeholder="Turkey"
              aria-label="Country"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="type" className={labelClass}>{"Scholarship type *"}</label>
            <select
              id="type"
              name="type"
              required
              disabled={isPending}
              defaultValue={d.type ?? ''}
              aria-label="Scholarship type"
              className={inputClass}
            >
              <option value="">{"Select type…"}</option>
              <option value="government">{"Government"}</option>
              <option value="merit">{"Merit"}</option>
              <option value="need-based">{"Need-based"}</option>
              <option value="partial">{"Partial"}</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="university_id" className={labelClass}>
            {"Linked university"} <span className="text-muted-foreground font-normal">{"(leave blank for country-wide)"}</span>
          </label>
          <select
            id="university_id"
            name="university_id"
            disabled={isPending}
            defaultValue={d.university_id ?? ''}
            aria-label="Linked university (optional)"
            className={inputClass}
          >
            <option value="">{"Country-wide (no specific university)"}</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_en} — {u.country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Coverage & amount */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{"Coverage & amount"}</h2>

        <div className="mb-4">
          <span className={labelClass}>{"What does it cover?"}</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
            {COVERAGE_ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <input
                  type="checkbox"
                  name={`coverage_${item}`}
                  value="on"
                  disabled={isPending}
                  defaultChecked={d.coverage?.includes(item) ?? false}
                  className="rounded border-input accent-primary"
                />
                {coverageLabels[item] ?? item}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="amount_usd" className={labelClass}>
              {"Annual amount (USD)"} <span className="text-muted-foreground font-normal">{"(optional)"}</span>
            </label>
            <input
              id="amount_usd"
              name="amount_usd"
              type="number"
              min="1"
              step="1"
              disabled={isPending}
              defaultValue={d.amount_usd}
              placeholder={"Leave blank if varies"}
              aria-label="Annual scholarship amount in USD"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="deadline_text" className={labelClass}>
              {"Deadline"} <span className="text-muted-foreground font-normal">{"(optional)"}</span>
            </label>
            <input
              id="deadline_text"
              name="deadline_text"
              type="text"
              disabled={isPending}
              defaultValue={d.deadline_text ?? ''}
              placeholder={"April 15 / Rolling"}
              aria-label="Application deadline"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Semesters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-1 text-foreground">{"Semesters"}</h2>
        <p className="text-sm text-muted-foreground mb-4">{"Each semester has a name (Fall/Spring/custom), a course start date, and an optional application deadline."}</p>
        <SemesterEditor defaultValue={d.semesters ?? []} />
      </div>

      {/* Descriptions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">
          {"Descriptions"} <span className="text-muted-foreground font-normal text-sm">{"(optional)"}</span>
        </h2>
        {(['en', 'ru', 'tk'] as const).map((lang) => (
          <div key={lang} className="mb-4 last:mb-0">
            <label htmlFor={`description_${lang}`} className={labelClass}>
              {descLabels[lang]}
            </label>
            <textarea
              id={`description_${lang}`}
              name={`description_${lang}`}
              rows={2}
              disabled={isPending}
              defaultValue={d[`description_${lang}` as 'description_en' | 'description_ru' | 'description_tk'] ?? ''}
              aria-label={`Scholarship description in ${lang}`}
              className={`${inputClass} resize-y`}
            />
          </div>
        ))}
      </div>

      {/* Application URL */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{"Application link"}</h2>
        <label htmlFor="application_url" className={labelClass}>
          {"Application URL"} <span className="text-muted-foreground font-normal">{"(optional)"}</span>
        </label>
        <input
          id="application_url"
          name="application_url"
          type="url"
          disabled={isPending}
          defaultValue={d.application_url ?? ''}
          placeholder="https://turkiyeburslari.gov.tr"
          aria-label="Scholarship application URL"
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href={cancelHref}
          aria-label="Cancel and go back"
          className="px-5 py-2.5 border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
        >
          {"Cancel"}
        </a>
        <button
          type="submit"
          disabled={isPending}
          aria-label={submitLabel}
          className="px-5 py-2.5 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
