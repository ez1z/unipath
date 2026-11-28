/**
 * Admin edit forms: plain HTML forms (they work with JavaScript off), described
 * as sections of fields so one component (components/admin/AdminFields.astro)
 * renders every record type, with the three languages side by side.
 */
import type { Lang, MessageKey } from '../../i18n/index.ts';

/** English is the record's own column; Turkmen and Russian live in `translations`. */
export interface Translated {
  en: string;
  tk: string;
  ru: string;
}

export type FormValue = string | string[] | boolean | Translated;
export type FormValues = Record<string, FormValue>;

/** Field name → message key (and its parameters). */
export type FormErrors = Record<string, { key: MessageKey; params?: Record<string, string> }>;

export interface Option {
  value: string;
  label: string;
  /** For grouped selects (e.g. universities and colleges). */
  group?: string;
}

interface Base {
  name: string;
  label: MessageKey;
  hint?: MessageKey;
  required?: boolean;
}

export type Field =
  | (Base & { kind: 'text' | 'url' | 'date'; maxLength?: number; placeholder?: string })
  | (Base & { kind: 'number'; step?: string; min?: number; max?: number })
  | (Base & { kind: 'textarea'; rows?: number })
  | (Base & { kind: 'translated'; multiline?: boolean; rows?: number })
  | (Base & { kind: 'select'; options: Option[]; blank?: MessageKey })
  | (Base & { kind: 'checkbox' })
  | (Base & { kind: 'checkboxes'; options: Option[] })
  | (Base & { kind: 'multiselect'; options: Option[]; size?: number })
  | (Base & { kind: 'image'; image: 'logo' | 'photo' });

export interface Section {
  legend: MessageKey;
  fields: Field[];
}

// ---------------------------------------------------------------------------
// Reading a submitted form
// ---------------------------------------------------------------------------

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function list(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function flag(form: FormData, name: string): boolean {
  return form.get(name) === 'on' || form.get(name) === '1';
}

export function translated(form: FormData, name: string): Translated {
  return {
    en: text(form, `${name}_en`),
    tk: text(form, `${name}_tk`),
    ru: text(form, `${name}_ru`),
  };
}

/** Lines of a textarea, trimmed, without empty ones. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Checks shared by every record type
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Lower-case latin letters, digits and dashes, as in every public URL. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Whole number in range, or null for an empty field; undefined when it isn't one. */
export function optionalInt(
  value: string,
  min = 0,
  max = 1_000_000_000,
): number | null | undefined {
  if (value === '') return null;
  if (!/^-?\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export function optionalNumber(value: string, min: number, max: number): number | null | undefined {
  if (value === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/** Records not checked for a year are flagged in the admin lists (SPEC). */
export const STALE_MONTHS = 12;

export function staleBefore(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - STALE_MONTHS);
  return d.toISOString().slice(0, 10);
}

export function isStale(lastChecked: string, today: string): boolean {
  return lastChecked < staleBefore(today);
}

/**
 * "Saving sets last_checked to today unless changed by hand" (SPEC): the form
 * sends the date it showed (`last_checked_was`); if the admin left it as it
 * was, today is stored.
 */
export function lastCheckedOnSave(form: FormData, today: string): string {
  const submitted = text(form, 'last_checked');
  const was = text(form, 'last_checked_was');
  return submitted === '' || submitted === was ? today : submitted;
}

/** The common record checks: slug, English name, source and publish rule, last checked. */
export function checkPublicRecord(
  values: {
    slug: string;
    name: Translated;
    sourceUrl: string;
    published: boolean;
    lastChecked: string;
  },
  errors: FormErrors,
): void {
  if (!SLUG.test(values.slug)) errors['slug'] = { key: 'admin.error.slug' };
  if (!values.name.en) errors['name'] = { key: 'admin.error.required' };
  if (values.sourceUrl && !isHttpUrl(values.sourceUrl))
    errors['source_url'] = { key: 'admin.error.url' };
  if (values.published && !values.sourceUrl) {
    errors['source_url'] = { key: 'admin.error.publishNeedsSource' };
  }
  if (!isDate(values.lastChecked)) errors['last_checked'] = { key: 'admin.error.date' };
}

export const LANGS_SIDE_BY_SIDE: readonly ('en' | Exclude<Lang, 'en'>)[] = ['en', 'tk', 'ru'];
