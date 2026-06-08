'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import { TMT_PER_USD } from '@/lib/constants';
import { Select } from '@/components/ui/Select';
import { MultiTagSelect } from '@/components/profile/MultiTagSelect';
import { updateProfileAction, type ProfileActionResult } from './actions';

const WorldMapPicker = dynamic(
  () => import('@/components/profile/WorldMapPicker').then((m) => m.WorldMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-xl border border-border bg-muted animate-pulse" />
    ),
  },
);

type ProfileRow = {
  display_name: string | null;
  toefl_total: number | null;
  ielts_overall: number | null;
  sat_total: number | null;
  act_total: number | null;
  gre_total: number | null;
  gmat_total: number | null;
  duolingo_score: number | null;
  gpa: number | null;
  gpa_scale: string;
  desired_countries: string[];
  desired_majors: string[];
  dream_university_ids: string[];
  budget_usd: number | null;
};

type UniOption = { id: string; name: { en: string } };

type Props = {
  locale: Locale;
  profile: ProfileRow | null;
  universities: UniOption[];
  majors: string[];
};

function numStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function ScoreField({
  label,
  name,
  defaultValue,
  min,
  max,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        defaultValue={defaultValue}
        placeholder={placeholder ?? `${min}–${max}`}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={label}
      />
    </div>
  );
}

export function ProfileForm({ locale, profile, universities, majors }: Props) {
  const t = useTranslations('profile');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ProfileActionResult | null>(null);

  const [desiredCountries, setDesiredCountries] = useState<string[]>(
    profile?.desired_countries ?? [],
  );
  const [desiredMajors, setDesiredMajors] = useState<string[]>(
    profile?.desired_majors ?? [],
  );
  const [dreamUniIds, setDreamUniIds] = useState<string[]>(
    profile?.dream_university_ids ?? [],
  );
  const [budgetUsd, setBudgetUsd] = useState<string>(numStr(profile?.budget_usd));
  const [gpaScale, setGpaScale] = useState<string>(profile?.gpa_scale ?? '4.0');

  const gpaScaleOptions = [
    { value: '4.0', label: t('gpa_scale_4') },
    { value: '5.0', label: t('gpa_scale_5') },
    { value: '100-point', label: t('gpa_scale_100') },
  ];

  const majorOptions = majors.map((m) => ({ value: m, label: m }));
  const uniOptions = universities.map((u) => ({ value: u.id, label: u.name.en }));

  const tmtEquiv =
    budgetUsd && !isNaN(Number(budgetUsd)) && Number(budgetUsd) > 0
      ? (Number(budgetUsd) * TMT_PER_USD).toLocaleString('ru-RU', {
          maximumFractionDigits: 0,
        })
      : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    desiredCountries.forEach((c) => formData.append('desired_countries', c));
    desiredMajors.forEach((m) => formData.append('desired_majors', m));
    dreamUniIds.forEach((id) => formData.append('dream_university_ids', id));
    setResult(null);
    startTransition(async () => {
      const r = await updateProfileAction(locale, formData);
      setResult(r);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Display name */}
      <SectionCard title={t('title')}>
        <div className="space-y-1">
          <label htmlFor="display_name" className="text-sm font-medium text-foreground">
            {t('display_name_label')}
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={profile?.display_name ?? ''}
            maxLength={80}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label={t('display_name_label')}
          />
        </div>
      </SectionCard>

      {/* Test Scores */}
      <SectionCard title={t('section_scores')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoreField
            label={t('toefl_label')}
            name="toefl_total"
            defaultValue={numStr(profile?.toefl_total)}
            min={0}
            max={120}
          />
          <ScoreField
            label={t('ielts_label')}
            name="ielts_overall"
            defaultValue={numStr(profile?.ielts_overall)}
            min={0}
            max={9}
            step={0.5}
            placeholder="0–9"
          />
          <ScoreField
            label={t('sat_label')}
            name="sat_total"
            defaultValue={numStr(profile?.sat_total)}
            min={400}
            max={1600}
          />
          <ScoreField
            label={t('act_label')}
            name="act_total"
            defaultValue={numStr(profile?.act_total)}
            min={1}
            max={36}
          />
          <ScoreField
            label={t('gre_label')}
            name="gre_total"
            defaultValue={numStr(profile?.gre_total)}
            min={260}
            max={340}
          />
          <ScoreField
            label={t('gmat_label')}
            name="gmat_total"
            defaultValue={numStr(profile?.gmat_total)}
            min={200}
            max={800}
          />
          <ScoreField
            label={t('duolingo_label')}
            name="duolingo_score"
            defaultValue={numStr(profile?.duolingo_score)}
            min={10}
            max={160}
          />
        </div>
      </SectionCard>

      {/* Academic Background */}
      <SectionCard title={t('section_academic')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="gpa" className="text-sm font-medium text-foreground">
              {t('gpa_label')}
            </label>
            <input
              id="gpa"
              name="gpa"
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={numStr(profile?.gpa)}
              placeholder="e.g. 3.8"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label={t('gpa_label')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              {t('gpa_scale_label')}
            </label>
            <input type="hidden" name="gpa_scale" value={gpaScale} />
            <Select
              value={gpaScale}
              onChange={setGpaScale}
              options={gpaScaleOptions}
              aria-label={t('gpa_scale_label')}
            />
          </div>
        </div>
      </SectionCard>

      {/* Study Preferences */}
      <SectionCard title={t('section_preferences')}>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('desired_countries_label')}
            </label>
            <WorldMapPicker
              selected={desiredCountries}
              onChange={setDesiredCountries}
              hint={t('desired_countries_hint')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('desired_majors_label')}
            </label>
            <MultiTagSelect
              displayOptions={majorOptions}
              selected={desiredMajors}
              onChange={setDesiredMajors}
              placeholder={t('majors_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('dream_universities_label')}
            </label>
            <MultiTagSelect
              displayOptions={uniOptions}
              selected={dreamUniIds}
              onChange={setDreamUniIds}
              placeholder={t('unis_placeholder')}
            />
          </div>
        </div>
      </SectionCard>

      {/* Budget */}
      <SectionCard title={t('section_budget')}>
        <div className="space-y-1">
          <label htmlFor="budget_usd" className="text-sm font-medium text-foreground">
            {t('budget_label')}
          </label>
          <input
            id="budget_usd"
            name="budget_usd"
            type="number"
            min={0}
            step={100}
            value={budgetUsd}
            onChange={(e) => setBudgetUsd(e.target.value)}
            placeholder="e.g. 8000"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label={t('budget_label')}
          />
          {tmtEquiv && (
            <p className="text-xs text-muted-foreground pt-1">
              {t('budget_tmt_hint', { amount: tmtEquiv })}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Result message */}
      {result && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            result.success
              ? 'bg-tk-green/10 text-tk-green border border-tk-green/20'
              : 'bg-crimson/10 text-crimson border border-crimson/20'
          }`}
        >
          {result.success ? t('save_success') : result.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        aria-label={isPending ? t('saving') : t('save_button')}
      >
        {isPending ? t('saving') : t('save_button')}
      </button>
    </form>
  );
}
