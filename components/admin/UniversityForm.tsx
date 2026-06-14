'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SemesterEditor } from '@/components/admin/SemesterEditor';
import { TuitionOptionsEditor } from '@/components/admin/TuitionOptionsEditor';
import type { Semester } from '@/lib/types/semester';
import type { TuitionOption } from '@/lib/types/tuition';

export type UniversityFormDefaults = {
  name_en?: string;
  name_ru?: string;
  name_tk?: string;
  country?: string;
  city?: string;
  tuition_usd?: string;
  moe_approved?: boolean;
  ranking_qs?: string;
  languages?: string;
  majors?: string;
  official_website?: string;
  application_portal_url?: string;
  entrance_requirements?: string;
  semesters?: Semester[];
  tuition_options?: TuitionOption[];
};

type Props = {
  defaultValues?: UniversityFormDefaults;
  action: (formData: FormData) => Promise<{ error: string } | never>;
  submitLabel: string;
  cancelHref: string;
};

const inputClass =
  'w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow';

const labelClass = 'block text-sm font-medium text-foreground mb-1.5';

export function UniversityForm({ defaultValues: d = {}, action, submitLabel, cancelHref }: Props) {
  const t = useTranslations('admin');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('uni_form_section_names')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="name_en" className={labelClass}>{t('uni_form_name_en')}</label>
            <input
              id="name_en" name="name_en" type="text" required
              defaultValue={d.name_en}
              disabled={isPending}
              placeholder="Middle East Technical University"
              aria-label="University name in English"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="name_ru" className={labelClass}>{t('uni_form_name_ru')}</label>
            <input
              id="name_ru" name="name_ru" type="text" required
              defaultValue={d.name_ru}
              disabled={isPending}
              placeholder="METU"
              aria-label="University name in Russian"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="name_tk" className={labelClass}>{t('uni_form_name_tk')}</label>
            <input
              id="name_tk" name="name_tk" type="text" required
              defaultValue={d.name_tk}
              disabled={isPending}
              placeholder="ODTU"
              aria-label="University name in Turkmen"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Location & Pricing */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('uni_form_section_location')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="country" className={labelClass}>{t('uni_form_country')}</label>
            <input
              id="country" name="country" type="text" required
              defaultValue={d.country}
              disabled={isPending}
              placeholder="Turkey"
              aria-label="Country"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>{t('uni_form_city')}</label>
            <input
              id="city" name="city" type="text" required
              defaultValue={d.city}
              disabled={isPending}
              placeholder="Ankara"
              aria-label="City"
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tuition_usd" className={labelClass}>{t('uni_form_tuition')}</label>
            <input
              id="tuition_usd" name="tuition_usd" type="number" min="0" step="1" required
              defaultValue={d.tuition_usd}
              disabled={isPending}
              placeholder="600"
              aria-label="Annual tuition in USD"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ranking_qs" className={labelClass}>
              {t('uni_form_ranking')} <span className="text-muted-foreground font-normal">{t('optional')}</span>
            </label>
            <input
              id="ranking_qs" name="ranking_qs" type="number" min="1" step="1"
              defaultValue={d.ranking_qs}
              disabled={isPending}
              placeholder={t('uni_form_ranking_placeholder')}
              aria-label="QS world ranking"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Tuition options (differentiated costs) */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-1 text-foreground">{t('uni_form_section_tuition_options')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('uni_form_tuition_options_desc')}</p>
        <TuitionOptionsEditor defaultValue={d.tuition_options ?? []} />
      </div>

      {/* Academic info */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('uni_form_section_academic')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="languages" className={labelClass}>
              {t('uni_form_languages')}
              <span className="text-muted-foreground font-normal ml-1">{t('separator_hint')}</span>
            </label>
            <input
              id="languages" name="languages" type="text" required
              defaultValue={d.languages}
              disabled={isPending}
              placeholder="English|Turkish"
              aria-label="Languages of instruction, pipe-separated"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="majors" className={labelClass}>
              {t('uni_form_majors')}
              <span className="text-muted-foreground font-normal ml-1">{t('separator_hint')}</span>
            </label>
            <input
              id="majors" name="majors" type="text" required
              defaultValue={d.majors}
              disabled={isPending}
              placeholder="Engineering|Computer Science"
              aria-label="Majors or faculties, pipe-separated"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="moe_approved"
              value="true"
              defaultChecked={d.moe_approved ?? false}
              disabled={isPending}
              aria-label="MoE approved (transfer eligible)"
              className="rounded border-input accent-primary w-4 h-4"
            />
            <span className="text-sm font-medium text-foreground">
              {t('uni_form_moe_label')}
              <span className="text-muted-foreground font-normal ml-1">{t('uni_form_moe_hint')}</span>
            </span>
          </label>
        </div>
      </div>

      {/* Links */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4 text-foreground">{t('uni_form_section_links')}</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="official_website" className={labelClass}>{t('uni_form_website')}</label>
            <input
              id="official_website" name="official_website" type="url" required
              defaultValue={d.official_website}
              disabled={isPending}
              placeholder="https://metu.edu.tr"
              aria-label="Official website URL"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="application_portal_url" className={labelClass}>{t('uni_form_portal')}</label>
            <input
              id="application_portal_url" name="application_portal_url" type="url" required
              defaultValue={d.application_portal_url}
              disabled={isPending}
              placeholder="https://oidb.metu.edu.tr"
              aria-label="Application portal URL"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Entrance requirements */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-1 text-foreground">{t('uni_form_section_entrance')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          JSON object mapping country to exam requirements. Optionally include a{' '}
          <code className="bg-muted px-1 rounded text-xs">document_requirements</code> array — these become
          the student&apos;s personal checklist for this university. Example:{' '}
          <code className="bg-muted px-1 rounded text-xs">
            {'{"turkey":{"yos":true},"document_requirements":["Passport","Transcript","TOEFL Score"]}'}
          </code>.
          Leave blank if none.
        </p>
        <textarea
          id="entrance_requirements"
          name="entrance_requirements"
          rows={5}
          defaultValue={d.entrance_requirements}
          disabled={isPending}
          placeholder='{"turkey":{"yos":true},"document_requirements":["Passport","Transcript","TOEFL Score"]}'
          aria-label="Entrance requirements as JSON"
          className={`${inputClass} resize-y font-mono text-xs`}
        />
      </div>

      {/* Semesters */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-1 text-foreground">{t('uni_form_section_semesters')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('uni_form_semesters_desc')}</p>
        <SemesterEditor defaultValue={d.semesters ?? []} />
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
