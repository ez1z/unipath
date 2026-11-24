'use client';

import { useState } from 'react';
import {
  editCountry,
  editEssay,
  editTest,
  parseState,
  serializeState,
  type CountryFlags,
  type CountryKey,
  type CountryReqs,
  type EditorState,
  type EssayEntry,
  type EssayItem,
  type EssayLengthUnit,
  type EssayType,
  type TestEntry,
  type TestItem,
} from '@/lib/admin/entrance-requirements-state';

// ── Shared styles ────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow';
const miniLabel = 'block text-xs font-medium text-muted-foreground mb-1';

// ── Read-only row (entries kept as imported) ─────────────────────────────────

function ReadOnlyRow({
  label,
  detail,
  disabled,
  onRemove,
  removeLabel,
}: {
  label: string;
  detail?: string;
  disabled: boolean;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Remove
        </button>
      </div>
      {detail && <p className="text-sm text-foreground mt-1">{detail}</p>}
      <p className="text-xs text-muted-foreground mt-1">Kept as imported — not editable here</p>
    </div>
  );
}

function rawString(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

// ── Test card ────────────────────────────────────────────────────────────────

const TEST_LABELS: Record<TestEntry['type'], string> = {
  toefl: 'TOEFL',
  ielts: 'IELTS',
  sat: 'SAT',
  duolingo: 'Duolingo',
};

function TestCard({
  test,
  disabled,
  onChange,
  onRemove,
}: {
  test: TestEntry;
  disabled: boolean;
  onChange: (id: string, updates: Record<string, string>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{TEST_LABELS[test.type]}</span>
        <button
          type="button"
          onClick={() => onRemove(test.id)}
          disabled={disabled}
          aria-label={`Remove ${TEST_LABELS[test.type]}`}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {test.type === 'toefl' && (
          <>
            <div>
              <label className={miniLabel}>Format</label>
              <select
                value={test.format}
                onChange={e => onChange(test.id, { format: e.target.value })}
                disabled={disabled}
                className={inputClass}
              >
                <option value="ibt">iBT — new format (0–120)</option>
                <option value="pbt">PBT — old format (0–6)</option>
                {test.format !== 'ibt' && test.format !== 'pbt' && (
                  <option value={test.format}>{test.format}</option>
                )}
              </select>
            </div>
            <div>
              <label className={miniLabel}>
                Minimum score (max {test.format === 'pbt' ? '6' : '120'})
              </label>
              <input
                type="number"
                min={0}
                max={test.format === 'pbt' ? 6 : 120}
                step={test.format === 'pbt' ? 0.5 : 1}
                value={test.min_score}
                onChange={e => onChange(test.id, { min_score: e.target.value })}
                disabled={disabled}
                placeholder={test.format === 'pbt' ? '4' : '80'}
                className={inputClass}
              />
            </div>
          </>
        )}

        {test.type === 'ielts' && (
          <div className="sm:col-span-2">
            <label className={miniLabel}>Minimum band score (0–9, step 0.5)</label>
            <input
              type="number"
              min={0}
              max={9}
              step={0.5}
              value={test.min_score}
              onChange={e => onChange(test.id, { min_score: e.target.value })}
              disabled={disabled}
              placeholder="6.5"
              className={inputClass}
            />
          </div>
        )}

        {test.type === 'sat' && (
          <>
            <div>
              <label className={miniLabel}>Min Math score (200–800)</label>
              <input
                type="number"
                min={200}
                max={800}
                step={10}
                value={test.min_math}
                onChange={e => onChange(test.id, { min_math: e.target.value })}
                disabled={disabled}
                placeholder="600"
                className={inputClass}
              />
            </div>
            <div>
              <label className={miniLabel}>Min Verbal score (200–800)</label>
              <input
                type="number"
                min={200}
                max={800}
                step={10}
                value={test.min_verbal}
                onChange={e => onChange(test.id, { min_verbal: e.target.value })}
                disabled={disabled}
                placeholder="550"
                className={inputClass}
              />
            </div>
          </>
        )}

        {test.type === 'duolingo' && (
          <div className="sm:col-span-2">
            <label className={miniLabel}>Minimum score (10–160)</label>
            <input
              type="number"
              min={10}
              max={160}
              step={5}
              value={test.min_score}
              onChange={e => onChange(test.id, { min_score: e.target.value })}
              disabled={disabled}
              placeholder="100"
              className={inputClass}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Essay card ───────────────────────────────────────────────────────────────

const ESSAY_TYPE_LABELS: Record<EssayType, string> = {
  personal_statement: 'Personal Statement',
  statement_of_purpose: 'Statement of Purpose',
  why_school: 'Why This School / Major',
  supplemental: 'Supplemental Essay',
  short_answer: 'Short Answer',
  open_prompt: 'Open Prompt',
};

function EssayCard({
  essay,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  essay: EssayEntry;
  index: number;
  disabled: boolean;
  onChange: (id: string, updates: Partial<EssayEntry>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Essay {index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(essay.id)}
          disabled={disabled}
          aria-label={`Remove essay ${index + 1}`}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="space-y-3">
        {/* Type */}
        <div>
          <label className={miniLabel}>Essay type</label>
          <select
            value={essay.essay_type}
            onChange={e => onChange(essay.id, { essay_type: e.target.value as EssayType })}
            disabled={disabled}
            className={inputClass}
          >
            {ESSAY_TYPE_LABELS && Object.entries(ESSAY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Length */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={miniLabel}>Length limit <span className="font-normal">(optional)</span></label>
            <input
              type="number"
              min={1}
              value={essay.length}
              onChange={e => onChange(essay.id, { length: e.target.value })}
              disabled={disabled}
              placeholder="650"
              className={inputClass}
            />
          </div>
          <div>
            <label className={miniLabel}>Unit</label>
            <select
              value={essay.length_unit}
              onChange={e => onChange(essay.id, { length_unit: e.target.value as EssayLengthUnit })}
              disabled={disabled}
              className={inputClass}
            >
              <option value="words">Words</option>
              <option value="characters">Characters</option>
            </select>
          </div>
        </div>

        {/* Description / prompt */}
        <div>
          <label className={miniLabel}>Essay prompt / description <span className="font-normal">(optional)</span></label>
          <textarea
            value={essay.description}
            onChange={e => onChange(essay.id, { description: e.target.value })}
            disabled={disabled}
            rows={3}
            placeholder="Describe a challenge you've overcome and what you learned from it."
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Country section ──────────────────────────────────────────────────────────

function CountrySection({
  label,
  countryKey,
  reqs,
  fields,
  disabled,
  onChange,
}: {
  label: string;
  countryKey: CountryKey;
  reqs: CountryReqs;
  fields: { key: keyof CountryFlags; label: string }[];
  disabled: boolean;
  onChange: (country: CountryKey, field: keyof CountryFlags, value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-2">
        {fields.map(f => (
          <label key={f.key} className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reqs[f.key]}
              onChange={e => onChange(countryKey, f.key, e.target.checked)}
              disabled={disabled}
              className="rounded border-input accent-primary w-4 h-4"
            />
            <span className="text-sm text-foreground">{f.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────

export function EntranceRequirementsEditor({
  defaultValue = '',
  name,
  disabled: disabledProp = false,
}: {
  defaultValue?: string;
  name: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<EditorState>(() => parseState(defaultValue));
  // Unparseable stored JSON is kept unchanged, so the inputs are locked.
  const disabled = disabledProp || state.invalidJson !== null;
  const [newDoc, setNewDoc] = useState('');

  // Tests
  function addTest(type: TestEntry['type']) {
    const id = String(Date.now());
    let t: TestEntry;
    if (type === 'toefl') t = { id, type: 'toefl', format: 'ibt', min_score: '', rest: {} };
    else if (type === 'ielts') t = { id, type: 'ielts', min_score: '', rest: {} };
    else if (type === 'sat') t = { id, type: 'sat', min_math: '', min_verbal: '', rest: {} };
    else t = { id, type: 'duolingo', min_score: '', rest: {} };
    setState(s => ({ ...s, tests: [...s.tests, t] }));
  }

  function removeTest(id: string) {
    setState(s => ({ ...s, tests: s.tests.filter(t => t.id !== id) }));
  }

  function updateTest(id: string, updates: Record<string, string>) {
    setState(s => ({
      ...s,
      tests: s.tests.map(t => (t.id === id && t.type !== '__other' ? editTest(t, updates) : t)),
    }));
  }

  // Essays
  function addEssay() {
    const id = String(Date.now());
    setState(s => ({
      ...s,
      essays: [...s.essays, { id, essay_type: 'personal_statement', length: '', length_unit: 'words', description: '', rest: {} }],
    }));
  }

  function removeEssay(id: string) {
    setState(s => ({ ...s, essays: s.essays.filter(e => e.id !== id) }));
  }

  function updateEssay(id: string, updates: Partial<EssayEntry>) {
    setState(s => ({
      ...s,
      essays: s.essays.map(e => (e.id === id && e.essay_type !== '__other' ? editEssay(e, updates) : e)),
    }));
  }

  // Country
  function setCountryField(country: CountryKey, field: keyof CountryFlags, value: boolean) {
    setState(s => ({ ...s, [country]: editCountry(s[country], field, value) }));
  }

  // Documents
  function addDoc() {
    const d = newDoc.trim();
    if (!d) return;
    setState(s => ({ ...s, docRequirements: [...s.docRequirements, d] }));
    setNewDoc('');
  }

  function removeDoc(i: number) {
    setState(s => ({ ...s, docRequirements: s.docRequirements.filter((_, j) => j !== i) }));
  }

  const availableTests = (['toefl', 'ielts', 'sat', 'duolingo'] as const).filter(
    type => !state.tests.some(t => t.type === type),
  );

  return (
    <div className="space-y-6">
      {state.invalidJson !== null && (
        <p role="alert" className="text-sm text-destructive">
          Stored requirements JSON is invalid; it will be kept unchanged.
        </p>
      )}

      {/* Standardized tests */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Standardized tests</h3>
        <div className="space-y-3">
          {state.tests.map((test: TestItem) =>
            test.type === '__other' ? (
              <ReadOnlyRow
                key={test.id}
                label={rawString(test.raw, 'type') ?? 'Unknown entry'}
                detail={
                  test.raw && typeof test.raw === 'object' && (test.raw as Record<string, unknown>).min_score != null
                    ? `Minimum score: ${String((test.raw as Record<string, unknown>).min_score)}`
                    : undefined
                }
                disabled={disabled}
                onRemove={() => removeTest(test.id)}
                removeLabel={`Remove ${rawString(test.raw, 'type') ?? 'unknown entry'}`}
              />
            ) : (
              <TestCard
                key={test.id}
                test={test}
                disabled={disabled}
                onChange={updateTest}
                onRemove={removeTest}
              />
            ),
          )}
          {availableTests.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {availableTests.map(type => (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => addTest(type)}
                  className="px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  + {TEST_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Essays */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Essays</h3>
        <div className="space-y-3">
          {state.essays.map((essay: EssayItem, i) =>
            essay.essay_type === '__other' ? (
              <ReadOnlyRow
                key={essay.id}
                label={`Essay ${i + 1} — ${rawString(essay.raw, 'essay_type') ?? 'Unknown entry'}`}
                disabled={disabled}
                onRemove={() => removeEssay(essay.id)}
                removeLabel={`Remove essay ${i + 1}`}
              />
            ) : (
              <EssayCard
                key={essay.id}
                essay={essay}
                index={i}
                disabled={disabled}
                onChange={updateEssay}
                onRemove={removeEssay}
              />
            ),
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={addEssay}
            className="px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            + Add essay
          </button>
        </div>
      </div>

      {/* Country requirements */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Country requirements</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CountrySection
            label="Turkey"
            countryKey="turkey"
            reqs={state.turkey}
            fields={[{ key: 'yos', label: 'YÖS exam required' }, { key: 'quota', label: 'Quota available' }]}
            disabled={disabled}
            onChange={setCountryField}
          />
          <CountrySection
            label="Russia"
            countryKey="russia"
            reqs={state.russia}
            fields={[{ key: 'ege', label: 'EGE exam required' }]}
            disabled={disabled}
            onChange={setCountryField}
          />
          <CountrySection
            label="United Kingdom"
            countryKey="uk"
            reqs={state.uk}
            fields={[{ key: 'ucas', label: 'Apply via UCAS' }]}
            disabled={disabled}
            onChange={setCountryField}
          />
          <CountrySection
            label="United States"
            countryKey="usa"
            reqs={state.usa}
            fields={[{ key: 'common_app', label: 'Apply via Common App' }, { key: 'quota', label: 'Quota available' }]}
            disabled={disabled}
            onChange={setCountryField}
          />
        </div>
      </div>

      {/* Document requirements */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Document requirements</h3>
        {state.docRequirements.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {state.docRequirements.map((doc, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full text-sm text-foreground">
                {doc}
                <button
                  type="button"
                  onClick={() => removeDoc(i)}
                  disabled={disabled}
                  aria-label={`Remove ${doc}`}
                  className="text-muted-foreground hover:text-destructive transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newDoc}
            onChange={e => setNewDoc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDoc(); } }}
            disabled={disabled}
            placeholder="e.g. Passport copy"
            aria-label="New document requirement"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={addDoc}
            disabled={disabled || !newDoc.trim()}
            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Serialized value for form submission */}
      <input type="hidden" name={name} value={serializeState(state)} />
    </div>
  );
}
