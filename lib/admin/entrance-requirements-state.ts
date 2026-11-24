// Pure state model + parsing + serialization for the admin entrance requirements editor.
// Anything the editor does not model is kept in `extra` / `rest` / passthrough entries so
// that saving never deletes data.

// ── Types ────────────────────────────────────────────────────────────────────

// Raw values other than 'ibt' / 'pbt' (e.g. "ibt/home edition") are kept as-is.
export type ToeflFormat = string;

type Rest = Record<string, unknown>;

export type ToeflEntry = { id: string; type: 'toefl'; format: ToeflFormat; min_score: string; rest: Rest };
export type IeltsEntry = { id: string; type: 'ielts'; min_score: string; rest: Rest };
export type SatEntry = { id: string; type: 'sat'; min_math: string; min_verbal: string; rest: Rest };
export type DuolingoEntry = { id: string; type: 'duolingo'; min_score: string; rest: Rest };
export type TestEntry = ToeflEntry | IeltsEntry | SatEntry | DuolingoEntry;
// Unknown / non-object test entry: read-only, serialized back exactly as `raw`.
export type OtherTestEntry = { id: string; type: '__other'; raw: unknown };
export type TestItem = TestEntry | OtherTestEntry;

export type EssayType =
  | 'personal_statement'
  | 'statement_of_purpose'
  | 'why_school'
  | 'supplemental'
  | 'short_answer'
  | 'open_prompt';

export type EssayLengthUnit = 'words' | 'characters';

export type EssayEntry = {
  id: string;
  essay_type: EssayType;
  length: string;
  length_unit: EssayLengthUnit;
  description: string;
  rest: Rest;
};
export type OtherEssayEntry = { id: string; essay_type: '__other'; raw: unknown };
export type EssayItem = EssayEntry | OtherEssayEntry;

export type CountryFlags = {
  yos: boolean;
  ege: boolean;
  ucas: boolean;
  common_app: boolean;
  quota: boolean;
};

export type CountryReqs = CountryFlags & { rest: Rest };

export type CountryKey = 'turkey' | 'russia' | 'uk' | 'usa';

export type EditorState = {
  tests: TestItem[];
  essays: EssayItem[];
  turkey: CountryReqs;
  russia: CountryReqs;
  uk: CountryReqs;
  usa: CountryReqs;
  docRequirements: string[];
  /** Top-level keys the editor does not manage. */
  extra: Rest;
  /** Original string when the stored JSON could not be parsed; returned unchanged on save. */
  invalidJson: string | null;
};

const COUNTRY_KEYS: CountryKey[] = ['turkey', 'russia', 'uk', 'usa'];
const FLAG_KEYS: (keyof CountryFlags)[] = ['yos', 'ege', 'ucas', 'common_app', 'quota'];

const VALID_ESSAY_TYPES: EssayType[] = [
  'personal_statement', 'statement_of_purpose', 'why_school',
  'supplemental', 'short_answer', 'open_prompt',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function emptyCountry(): CountryReqs {
  return { yos: false, ege: false, ucas: false, common_app: false, quota: false, rest: {} };
}

// Copy of `raw` without the given keys.
function omit(raw: Record<string, unknown>, keys: string[]): Rest {
  const out: Rest = {};
  for (const [k, v] of Object.entries(raw)) if (!keys.includes(k)) out[k] = v;
  return out;
}

// A numeric field is managed by the editor only when it is a number; any other raw value
// (string, null, ...) is left in `rest` so it is not rewritten.
function numStr(v: unknown): string {
  return typeof v === 'number' ? String(v) : '';
}

function managedNumKeys(r: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter(k => typeof r[k] === 'number');
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseCountry(raw: unknown): CountryReqs | null {
  // Non-object or empty object: not managed, caller keeps it in `extra`.
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) return null;
  const c = emptyCountry();
  const managed: string[] = [];
  for (const k of FLAG_KEYS) {
    if (raw[k] === true) {
      c[k] = true;
      managed.push(k);
    }
  }
  c.rest = omit(raw, managed);
  return c;
}

function parseTests(raw: unknown): TestItem[] {
  const tests: TestItem[] = [];
  (raw as unknown[]).forEach((t, i) => {
    const id = String(i);
    if (!isPlainObject(t)) {
      tests.push({ id, type: '__other', raw: t });
    } else if (t.type === 'toefl') {
      const keys = ['type', ...managedNumKeys(t, ['min_score'])];
      const format = typeof t.format === 'string' ? t.format : 'ibt';
      if (typeof t.format === 'string') keys.push('format');
      tests.push({ id, type: 'toefl', format, min_score: numStr(t.min_score), rest: omit(t, keys) });
    } else if (t.type === 'ielts') {
      const keys = ['type', ...managedNumKeys(t, ['min_score'])];
      tests.push({ id, type: 'ielts', min_score: numStr(t.min_score), rest: omit(t, keys) });
    } else if (t.type === 'sat') {
      const keys = ['type', ...managedNumKeys(t, ['min_math', 'min_verbal'])];
      tests.push({ id, type: 'sat', min_math: numStr(t.min_math), min_verbal: numStr(t.min_verbal), rest: omit(t, keys) });
    } else if (t.type === 'duolingo') {
      const keys = ['type', ...managedNumKeys(t, ['min_score'])];
      tests.push({ id, type: 'duolingo', min_score: numStr(t.min_score), rest: omit(t, keys) });
    } else {
      tests.push({ id, type: '__other', raw: t });
    }
  });
  return tests;
}

function parseEssays(raw: unknown): EssayItem[] {
  const essays: EssayItem[] = [];
  (raw as unknown[]).forEach((e, i) => {
    const id = String(i);
    if (!isPlainObject(e) || !VALID_ESSAY_TYPES.includes(e.essay_type as EssayType)) {
      essays.push({ id, essay_type: '__other', raw: e });
      return;
    }
    const keys = ['essay_type'];
    // An unknown unit (e.g. "pages") would be rewritten as "words", so the pair stays in `rest`.
    const knownUnit = e.length_unit === undefined || e.length_unit === 'words' || e.length_unit === 'characters';
    const lengthManaged = typeof e.length === 'number' && knownUnit;
    if (lengthManaged) keys.push('length', 'length_unit');
    if (typeof e.description === 'string') keys.push('description');
    essays.push({
      id,
      essay_type: e.essay_type as EssayType,
      length: lengthManaged ? numStr(e.length) : '',
      length_unit: e.length_unit === 'characters' ? 'characters' : 'words',
      description: typeof e.description === 'string' ? e.description : '',
      rest: omit(e, keys),
    });
  });
  return essays;
}

export function parseState(jsonStr: string): EditorState {
  const state: EditorState = {
    tests: [],
    essays: [],
    turkey: emptyCountry(),
    russia: emptyCountry(),
    uk: emptyCountry(),
    usa: emptyCountry(),
    docRequirements: [],
    extra: {},
    invalidJson: null,
  };
  if (jsonStr.trim() === '') return state;

  let raw: unknown;
  try { raw = JSON.parse(jsonStr); } catch { raw = undefined; }
  if (!isPlainObject(raw)) {
    state.invalidJson = jsonStr;
    return state;
  }

  const managed: string[] = [];
  // Arrays are managed only when non-empty; an empty or non-array value stays in `extra`.
  if (Array.isArray(raw.tests) && raw.tests.length > 0) {
    state.tests = parseTests(raw.tests);
    managed.push('tests');
  }
  if (Array.isArray(raw.essays) && raw.essays.length > 0) {
    state.essays = parseEssays(raw.essays);
    managed.push('essays');
  }
  for (const k of COUNTRY_KEYS) {
    const c = parseCountry(raw[k]);
    if (c) {
      state[k] = c;
      managed.push(k);
    }
  }
  if (Array.isArray(raw.document_requirements) && raw.document_requirements.length > 0) {
    state.docRequirements = raw.document_requirements as string[];
    managed.push('document_requirements');
  }
  state.extra = omit(raw, managed);
  return state;
}

// ── Editing ──────────────────────────────────────────────────────────────────
// Editing a field hands it to the editor: any unmanaged raw value kept in `rest` for that key
// is dropped, so clearing the input removes the field instead of bringing the old value back.

export function editTest(t: TestEntry, updates: Record<string, string>): TestEntry {
  return { ...t, ...updates, rest: omit(t.rest, Object.keys(updates)) } as TestEntry;
}

export function editEssay(e: EssayEntry, updates: Partial<Omit<EssayEntry, 'id' | 'rest'>>): EssayEntry {
  // The unit is only written together with a length, so it is handed over with the length.
  const keys = Object.keys(updates).filter(k => k !== 'length_unit');
  if ('length' in updates) keys.push('length_unit');
  return { ...e, ...updates, rest: omit(e.rest, keys) };
}

export function editCountry(c: CountryReqs, field: keyof CountryFlags, value: boolean): CountryReqs {
  return { ...c, [field]: value, rest: omit(c.rest, [field]) };
}

// ── Serialization ────────────────────────────────────────────────────────────

function serializeTest(t: TestItem): unknown {
  if (t.type === '__other') return t.raw;
  if (t.type === 'toefl') return { type: 'toefl', ...t.rest, format: t.format, ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
  if (t.type === 'ielts') return { type: 'ielts', ...t.rest, ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
  if (t.type === 'sat') return { type: 'sat', ...t.rest, ...(t.min_math !== '' ? { min_math: Number(t.min_math) } : {}), ...(t.min_verbal !== '' ? { min_verbal: Number(t.min_verbal) } : {}) };
  return { type: 'duolingo', ...t.rest, ...(t.min_score !== '' ? { min_score: Number(t.min_score) } : {}) };
}

function serializeEssay(e: EssayItem): unknown {
  if (e.essay_type === '__other') return e.raw;
  return {
    ...e.rest,
    essay_type: e.essay_type,
    ...(e.length !== '' ? { length: Number(e.length), length_unit: e.length_unit } : {}),
    ...(e.description.trim() ? { description: e.description.trim() } : {}),
  };
}

function serializeCountry(r: CountryReqs): Rest | null {
  const checked: Rest = {};
  for (const k of FLAG_KEYS) if (r[k]) checked[k] = true;
  const out = { ...r.rest, ...checked };
  return Object.keys(out).length > 0 ? out : null;
}

export function serializeState(s: EditorState): string {
  if (s.invalidJson !== null) return s.invalidJson;
  const obj: Record<string, unknown> = { ...s.extra };
  if (s.tests.length > 0) obj.tests = s.tests.map(serializeTest);
  if (s.essays.length > 0) obj.essays = s.essays.map(serializeEssay);
  for (const k of COUNTRY_KEYS) {
    const c = serializeCountry(s[k]);
    if (c) obj[k] = c;
  }
  if (s.docRequirements.length > 0) obj.document_requirements = s.docRequirements;
  return Object.keys(obj).length > 0 ? JSON.stringify(obj) : '';
}
