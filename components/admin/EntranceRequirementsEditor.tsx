'use client';

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type ToeflFormat = 'ibt' | 'pbt';

type ToeflEntry = { id: string; type: 'toefl'; format: ToeflFormat; min_score: string };
type IeltsEntry = { id: string; type: 'ielts'; min_score: string };
type SatEntry = { id: string; type: 'sat'; min_math: string; min_verbal: string };
type DuolingoEntry = { id: string; type: 'duolingo'; min_score: string };
type TestEntry = ToeflEntry | IeltsEntry | SatEntry | DuolingoEntry;

type EssayType =
  | 'personal_statement'
  | 'statement_of_purpose'
  | 'why_school'
  | 'supplemental'
  | 'short_answer'
  | 'open_prompt';

type EssayLengthUnit = 'words' | 'characters';

type EssayEntry = {
  id: string;
  essay_type: EssayType;
  length: string;
  length_unit: EssayLengthUnit;
  description: string;
};

type CountryReqs = {
  yos: boolean;
  ege: boolean;
  ucas: boolean;
  common_app: boolean;
  quota: boolean;
};

const EMPTY_COUNTRY: CountryReqs = { yos: false, ege: false, ucas: false, common_app: false, quota: false };

type CountryKey = 'turkey' | 'russia' | 'uk' | 'usa';

type EditorState = {
  tests: TestEntry[];
  essays: EssayEntry[];
  turkey: CountryReqs;
  russia: CountryReqs;
  uk: CountryReqs;
  usa: CountryReqs;
  docRequirements: string[];
};

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseCountry(raw: unknown): CountryReqs {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_COUNTRY };
  const d = raw as Record<string, unknown>;
  return {
    yos: !!d.yos,
    ege: !!d.ege,
    ucas: !!d.ucas,
    common_app: !!d.common_app,
    quota: !!d.quota,
  };
}

function parseTests(raw: unknown): TestEntry[] {
  if (!Array.isArray(raw)) return [];
  const tests: TestEntry[] = [];
  let i = 0;
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const id = String(i++);
    const r = t as Record<string, unknown>;
    if (r.type === 'toefl') {
      tests.push({ id, type: 'toefl', format: r.format === 'pbt' ? 'pbt' : 'ibt', min_score: r.min_score != null ? String(r.min_score) : '' });
    } else if (r.type === 'ielts') {
      tests.push({ id, type: 'ielts', min_score: r.min_score != null ? String(r.min_score) : '' });
    } else if (r.type === 'sat') {
      tests.push({ id, type: 'sat', min_math: r.min_math != null ? String(r.min_math) : '', min_verbal: r.min_verbal != null ? String(r.min_verbal) : '' });
    } else if (r.type === 'duolingo') {
      tests.push({ id, type: 'duolingo', min_score: r.min_score != null ? String(r.min_score) : '' });
    }
  }
  return tests;
}

const VALID_ESSAY_TYPES: EssayType[] = [
  'personal_statement', 'statement_of_purpose', 'why_school',
  'supplemental', 'short_answer', 'open_prompt',
];

function parseEssays(raw: unknown): EssayEntry[] {
  if (!Array.isArray(raw)) return [];
  const essays: EssayEntry[] = [];
  let i = 0;
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    const essay_type = VALID_ESSAY_TYPES.includes(r.essay_type as EssayType)
      ? (r.essay_type as EssayType)
      : 'personal_statement';
    essays.push({
      id: String(i++),
      essay_type,
      length: r.length != null ? String(r.length) : '',
      length_unit: r.length_unit === 'characters' ? 'characters' : 'words',
      description: typeof r.description === 'string' ? r.description : '',
    });
  }
  return essays;
}

function parseState(jsonStr: string): EditorState {
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(jsonStr || '{}'); } catch { /* invalid JSON — keep empty default */ }
  return {
    tests: parseTests(raw.tests),
    essays: parseEssays(raw.essays),
    turkey: parseCountry(raw.turkey),
    russia: parseCountry(raw.russia),
    uk: parseCountry(raw.uk),
    usa: parseCountry(raw.usa),
    docRequirements: Array.isArray(raw.document_requirements) ? (raw.document_requirements as string[]) : [],
  };
}

// ── Serialization ────────────────────────────────────────────────────────────

function serializeTest(t: TestEntry): Record<string, unknown> {
  if (t.type === 'toefl') return { type: 'toefl', format: t.format, ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
  if (t.type === 'ielts') return { type: 'ielts', ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
  if (t.type === 'sat') return { type: 'sat', ...(t.min_math !== '' ? { min_math: Number(t.min_math) } : {}), ...(t.min_verbal !== '' ? { min_verbal: Number(t.min_verbal) } : {}) };
  return { type: 'duolingo', ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
}

function serializeEssay(e: EssayEntry): Record<string, unknown> {
  return {
    essay_type: e.essay_type,
    ...(e.length !== '' ? { length: Number(e.length), length_unit: e.length_unit } : {}),
    ...(e.description.trim() ? { description: e.description.trim() } : {}),
  };
}

function serializeCountry(r: CountryReqs): Record<string, boolean> | null {
  const entries = (Object.entries(r) as [string, boolean][]).filter(([, v]) => v);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

function serializeState(s: EditorState): string {
  const obj: Record<string, unknown> = {};
  if (s.tests.length > 0) obj.tests = s.tests.map(serializeTest);
  if (s.essays.length > 0) obj.essays = s.essays.map(serializeEssay);
  const tc = serializeCountry(s.turkey);
  const rc = serializeCountry(s.russia);
  const uc = serializeCountry(s.uk);
  const uc2 = serializeCountry(s.usa);
  if (tc) obj.turkey = tc;
  if (rc) obj.russia = rc;
  if (uc) obj.uk = uc;
  if (uc2) obj.usa = uc2;
  if (s.docRequirements.length > 0) obj.document_requirements = s.docRequirements;
  return Object.keys(obj).length > 0 ? JSON.stringify(obj) : '';
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow';
const miniLabel = 'block text-xs font-medium text-muted-foreground mb-1';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (id: string, updates: Record<string, any>) => void;
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
              </select>
            </div>
            <div>
              <label className={miniLabel}>
                Minimum score (max {test.format === 'ibt' ? '120' : '6'})
              </label>
              <input
                type="number"
                min={0}
                max={test.format === 'ibt' ? 120 : 6}
                step={test.format === 'ibt' ? 1 : 0.5}
                value={test.min_score}
                onChange={e => onChange(test.id, { min_score: e.target.value })}
                disabled={disabled}
                placeholder={test.format === 'ibt' ? '80' : '4'}
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
  fields: { key: keyof CountryReqs; label: string }[];
  disabled: boolean;
  onChange: (country: CountryKey, field: keyof CountryReqs, value: boolean) => void;
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
  disabled = false,
}: {
  defaultValue?: string;
  name: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<EditorState>(() => parseState(defaultValue));
  const [newDoc, setNewDoc] = useState('');

  // Tests
  function addTest(type: TestEntry['type']) {
    const id = String(Date.now());
    let t: TestEntry;
    if (type === 'toefl') t = { id, type: 'toefl', format: 'ibt', min_score: '' };
    else if (type === 'ielts') t = { id, type: 'ielts', min_score: '' };
    else if (type === 'sat') t = { id, type: 'sat', min_math: '', min_verbal: '' };
    else t = { id, type: 'duolingo', min_score: '' };
    setState(s => ({ ...s, tests: [...s.tests, t] }));
  }

  function removeTest(id: string) {
    setState(s => ({ ...s, tests: s.tests.filter(t => t.id !== id) }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateTest(id: string, updates: Record<string, any>) {
    setState(s => ({
      ...s,
      tests: s.tests.map(t => (t.id === id ? ({ ...t, ...updates } as TestEntry) : t)),
    }));
  }

  // Essays
  function addEssay() {
    const id = String(Date.now());
    setState(s => ({
      ...s,
      essays: [...s.essays, { id, essay_type: 'personal_statement', length: '', length_unit: 'words', description: '' }],
    }));
  }

  function removeEssay(id: string) {
    setState(s => ({ ...s, essays: s.essays.filter(e => e.id !== id) }));
  }

  function updateEssay(id: string, updates: Partial<EssayEntry>) {
    setState(s => ({
      ...s,
      essays: s.essays.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }));
  }

  // Country
  function setCountryField(country: CountryKey, field: keyof CountryReqs, value: boolean) {
    setState(s => ({ ...s, [country]: { ...s[country], [field]: value } }));
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
      {/* Standardized tests */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Standardized tests</h3>
        <div className="space-y-3">
          {state.tests.map(test => (
            <TestCard
              key={test.id}
              test={test}
              disabled={disabled}
              onChange={updateTest}
              onRemove={removeTest}
            />
          ))}
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
          {state.essays.map((essay, i) => (
            <EssayCard
              key={essay.id}
              essay={essay}
              index={i}
              disabled={disabled}
              onChange={updateEssay}
              onRemove={removeEssay}
            />
          ))}
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
