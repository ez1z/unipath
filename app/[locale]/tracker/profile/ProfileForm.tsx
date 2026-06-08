'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import { TMT_PER_USD } from '@/lib/constants';
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
  defaultDisplayName: string;
};

function numStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

// Official ETS TOEFL conversion table
const TOEFL_BANDS = [
  { min120: 114, max120: 120, newScale: '6.0',     cefr: 'C2' },
  { min120: 95,  max120: 113, newScale: '5.0–5.5', cefr: 'C1' },
  { min120: 72,  max120: 94,  newScale: '4.0–4.5', cefr: 'B2' },
  { min120: 42,  max120: 71,  newScale: '3.0–3.5', cefr: 'B1' },
  { min120: 20,  max120: 41,  newScale: '2.0–2.5', cefr: 'A2' },
  { min120: 0,   max120: 19,  newScale: '1.0–1.5', cefr: 'A1' },
];
const NEW_SCALE_BANDS = [
  { min6: 6.0, midpoint120: 117, range120: '114–120', cefr: 'C2' },
  { min6: 5.5, midpoint120: 104, range120: '95–113',  cefr: 'C1' },
  { min6: 5.0, midpoint120: 104, range120: '95–113',  cefr: 'C1' },
  { min6: 4.5, midpoint120: 83,  range120: '72–94',   cefr: 'B2' },
  { min6: 4.0, midpoint120: 83,  range120: '72–94',   cefr: 'B2' },
  { min6: 3.5, midpoint120: 57,  range120: '42–71',   cefr: 'B1' },
  { min6: 3.0, midpoint120: 57,  range120: '42–71',   cefr: 'B1' },
  { min6: 2.5, midpoint120: 31,  range120: '20–41',   cefr: 'A2' },
  { min6: 2.0, midpoint120: 31,  range120: '20–41',   cefr: 'A2' },
  { min6: 1.5, midpoint120: 10,  range120: '0–19',    cefr: 'A1' },
  { min6: 0,   midpoint120: 10,  range120: '0–19',    cefr: 'A1' },
];

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

export function ProfileForm({
  locale,
  profile,
  universities,
  majors,
  defaultDisplayName,
}: Props) {
  const t = useTranslations('profile');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ProfileActionResult | null>(null);

  // TOEFL controlled state
  const [toeflScale, setToeflScale] = useState<'120' | '6'>('120');
  const [toeflInput, setToeflInput] = useState<string>(numStr(profile?.toefl_total));

  // 120-scale value to store
  const toefl120Value = (() => {
    const n = parseFloat(toeflInput);
    if (isNaN(n) || toeflInput === '') return '';
    if (toeflScale === '120') return String(Math.min(120, Math.max(0, Math.round(n))));
    const band = NEW_SCALE_BANDS.find((b) => n >= b.min6);
    return String(band?.midpoint120 ?? 0);
  })();

  // Converted display
  const toeflConverted = (() => {
    const n = parseFloat(toeflInput);
    if (isNaN(n) || n <= 0) return null;
    if (toeflScale === '120') {
      const band = TOEFL_BANDS.find((b) => n >= b.min120 && n <= b.max120);
      if (!band) return null;
      return `${band.newScale} / 6.0 · CEFR ${band.cefr}`;
    }
    const band = NEW_SCALE_BANDS.find((b) => n >= b.min6);
    if (!band) return null;
    return `${band.range120} / 120 · CEFR ${band.cefr}`;
  })();

  // GPA controlled state (Turkmen 5.0 scale) with validation
  const [gpaInput, setGpaInput] = useState<string>(numStr(profile?.gpa));
  const gpaError = (() => {
    if (gpaInput === '') return null;
    const n = parseFloat(gpaInput);
    if (isNaN(n)) return t('gpa_error_range');
    if (n < 2.0 || n > 5.0) return t('gpa_error_range');
    return null;
  })();

  const gpa4Equiv = (() => {
    const n = parseFloat(gpaInput);
    if (isNaN(n) || n <= 0) return null;
    return ((n / 5) * 4).toFixed(2);
  })();

  const gpa100Equiv = (() => {
    const n = parseFloat(gpaInput);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 20);
  })();

  // Array selections
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
    // Override toefl_total with always-120-scale value
    formData.set('toefl_total', toefl120Value);
    // Arrays must be appended manually
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
            defaultValue={defaultDisplayName}
            maxLength={80}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label={t('display_name_label')}
          />
        </div>
      </SectionCard>

      {/* Test Scores */}
      <SectionCard title={t('section_scores')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* TOEFL — scale selector + conversion */}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="toefl_input" className="text-sm font-medium text-foreground">
              {t('toefl_label')}
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="toefl_input"
                type="number"
                min={0}
                max={toeflScale === '120' ? 120 : 6}
                step={toeflScale === '120' ? 1 : 0.5}
                value={toeflInput}
                onChange={(e) => setToeflInput(e.target.value)}
                placeholder={toeflScale === '120' ? '0–120' : '0–6'}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={t('toefl_label')}
              />
              <input type="hidden" name="toefl_total" value={toefl120Value} />
              <select
                value={toeflScale}
                onChange={(e) => {
                  const next = e.target.value as '120' | '6';
                  const n = parseFloat(toeflInput);
                  if (!isNaN(n) && n > 0) {
                    if (next === '6' && toeflScale === '120') {
                      const band = TOEFL_BANDS.find((b) => n >= b.min120 && n <= b.max120);
                      if (band) setToeflInput(band.newScale.split('–')[0]);
                    } else if (next === '120' && toeflScale === '6') {
                      const band = NEW_SCALE_BANDS.find((b) => n >= b.min6);
                      if (band) setToeflInput(String(band.midpoint120));
                    }
                  }
                  setToeflScale(next);
                }}
                className="w-24 px-2 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={t('toefl_scale_label')}
              >
                <option value="120">{t('toefl_scale_120')}</option>
                <option value="6">{t('toefl_scale_6')}</option>
              </select>
            </div>
            {toeflConverted && (
              <p className="text-xs text-muted-foreground">
                {t('toefl_converted')}: {toeflConverted}
              </p>
            )}
          </div>

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
        <div className="space-y-1 max-w-xs">
          <label htmlFor="gpa" className="text-sm font-medium text-foreground">
            {t('gpa_label')}
          </label>
          <input
            id="gpa"
            name="gpa"
            type="number"
            min={2}
            max={5}
            step={0.01}
            value={gpaInput}
            onChange={(e) => setGpaInput(e.target.value)}
            placeholder="2.0–5.0"
            className={`w-full px-3 py-2 text-sm border rounded-lg bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors ${
              gpaError
                ? 'border-crimson focus:ring-crimson/20 text-crimson'
                : 'border-border focus:ring-primary/40'
            }`}
            aria-label={t('gpa_label')}
            aria-invalid={!!gpaError}
          />
          {gpaError ? (
            <p className="text-xs text-crimson" role="alert">{gpaError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('gpa_hint')}</p>
          )}
        </div>

        {!gpaError && (gpa4Equiv !== null || gpa100Equiv !== null) && (
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">{t('gpa_4_equiv')}</p>
              <p className="text-sm font-semibold text-foreground">{gpa4Equiv} / 4.0</p>
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">{t('gpa_100_equiv')}</p>
              <p className="text-sm font-semibold text-foreground">{gpa100Equiv} / 100</p>
            </div>
          </div>
        )}
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
              searchPlaceholder={t('country_search_placeholder')}
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
        <div className="space-y-1 max-w-xs">
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
