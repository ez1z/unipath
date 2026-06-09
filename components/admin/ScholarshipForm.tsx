'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('admin');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameLabelKeys = {
    en: 'sch_form_name_en_label',
    ru: 'sch_form_name_ru_label',
    tk: 'sch_form_name_tk_label',
  } as const;

  const descLabelKeys = {
    en: 'sch_form_desc_en_label',
    ru: 'sch_form_desc_ru_label',
    tk: 'sch_form_desc_tk_label',
  } as const;

  const coverageLabelKeys: Record<string, 'sch_form_coverage_tuition' | 'sch_form_coverage_accommodation' | 'sch_form_coverage_flights' | 'sch_form_coverage_stipend' | 'sch_form_coverage_health'> = {
    tuition: 'sch_form_coverage_tuition',
    accommodation: 'sch_form_coverage_accommodation',
    flights: 'sch_form_coverage_flights',
    stipend: 'sch_form_coverage_stipend',
    health: 'sch_form_coverage_health',
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
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('sch_form_section_names')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['en', 'ru', 'tk'] as const).map((lang) => (
            <div key={lang}>
              <label htmlFor={`name_${lang}`} className={labelClass}>
                {t(nameLabelKeys[lang])}
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
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('sch_form_section_location')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="country" className={labelClass}>{t('sch_form_country')}</label>
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
            <label htmlFor="type" className={labelClass}>{t('sch_form_type_label')}</label>
            <select
              id="type"
              name="type"
              required
              disabled={isPending}
              defaultValue={d.type ?? ''}
              aria-label="Scholarship type"
              className={inputClass}
            >
              <option value="">{t('sch_form_type_placeholder')}</option>
              <option value="government">{t('sch_form_type_government')}</option>
              <option value="merit">{t('sch_form_type_merit')}</option>
              <option value="need-based">{t('sch_form_type_need_based')}</option>
              <option value="partial">{t('sch_form_type_partial')}</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="university_id" className={labelClass}>
            {t('sch_form_uni_label')} <span className="text-muted-foreground font-normal">{t('sch_form_uni_hint')}</span>
          </label>
          <select
            id="university_id"
            name="university_id"
            disabled={isPending}
            defaultValue={d.university_id ?? ''}
            aria-label="Linked university (optional)"
            className={inputClass}
          >
            <option value="">{t('sch_form_uni_nationwide')}</option>
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
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('sch_form_section_coverage')}</h2>

        <div className="mb-4">
          <span className={labelClass}>{t('sch_form_coverage_question')}</span>
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
                {coverageLabelKeys[item] ? t(coverageLabelKeys[item]) : item}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="amount_usd" className={labelClass}>
              {t('sch_form_amount_label')} <span className="text-muted-foreground font-normal">{t('optional')}</span>
            </label>
            <input
              id="amount_usd"
              name="amount_usd"
              type="number"
              min="1"
              step="1"
              disabled={isPending}
              defaultValue={d.amount_usd}
              placeholder={t('sch_form_amount_placeholder')}
              aria-label="Annual scholarship amount in USD"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="deadline_text" className={labelClass}>
              {t('sch_form_deadline_label')} <span className="text-muted-foreground font-normal">{t('optional')}</span>
            </label>
            <input
              id="deadline_text"
              name="deadline_text"
              type="text"
              disabled={isPending}
              defaultValue={d.deadline_text ?? ''}
              placeholder={t('sch_form_deadline_placeholder')}
              aria-label="Application deadline"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Semesters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-1 text-foreground">{t('sch_form_section_semesters')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('sch_form_semesters_desc')}</p>
        <SemesterEditor defaultValue={d.semesters ?? []} />
      </div>

      {/* Descriptions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">
          {t('sch_form_section_desc')} <span className="text-muted-foreground font-normal text-sm">{t('sch_form_desc_optional')}</span>
        </h2>
        {(['en', 'ru', 'tk'] as const).map((lang) => (
          <div key={lang} className="mb-4 last:mb-0">
            <label htmlFor={`description_${lang}`} className={labelClass}>
              {t(descLabelKeys[lang])}
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
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('sch_form_section_link')}</h2>
        <label htmlFor="application_url" className={labelClass}>
          {t('sch_form_link_label')} <span className="text-muted-foreground font-normal">{t('optional')}</span>
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
          {t('cancel')}
        </a>
        <button
          type="submit"
          disabled={isPending}
          aria-label={submitLabel}
          className="px-5 py-2.5 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? t('saving') : submitLabel}
        </button>
      </div>
    </form>
  );
}
