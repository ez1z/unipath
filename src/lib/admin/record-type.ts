/**
 * What every admin record type (universities, colleges, programs, pathways,
 * scholarships) provides to the generic list and edit pages in pages/admin.
 */
import { sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Lang, MessageKey, Translate } from '../../i18n/index.ts';
import type { Db } from '../db/client.ts';
import type { FormErrors, FormValues, Section } from './form.ts';

export const ADMIN_TYPES = [
  'universities',
  'colleges',
  'programs',
  'pathways',
  'scholarships',
] as const;
export type AdminType = (typeof ADMIN_TYPES)[number];

export function isAdminType(value: unknown): value is AdminType {
  return typeof value === 'string' && (ADMIN_TYPES as readonly string[]).includes(value);
}

export type ListFilterName = 'q' | 'country' | 'published' | 'stale' | 'status' | 'level';

export interface ListFilter {
  q: string;
  country: string;
  /** 'yes', 'no' or '' (both). */
  published: string;
  stale: boolean;
  /** Ministry status (universities). */
  status: string;
  /** Program level. */
  level: string;
  page: number;
}

export const LIST_PAGE_SIZE = 50;

export interface ListRow {
  id: number;
  title: string;
  /** Provider, country, level… */
  details: string;
  published: boolean | null;
  lastChecked: string | null;
  stale: boolean;
  /** The public page, when the record is published. */
  publicPath: string | null;
}

export type SaveResult = { ok: true; id: number } | { ok: false; errors: FormErrors };
export type RemoveResult = { ok: true } | { ok: false; error: MessageKey };

export interface Parsed {
  values: FormValues;
  errors: FormErrors;
  /** Writes the record, its texts and an audit row in one D1 batch. Only call without errors. */
  save(db: Db, adminId: string, id: number | null, before: FormValues | null): Promise<SaveResult>;
}

export interface RecordType {
  type: AdminType;
  /** List and form headings. */
  pluralKey: MessageKey;
  singularKey: MessageKey;
  filters: ListFilterName[];
  /** Catalogue writes rebuild the search index. */
  searchable: boolean;
  list(
    db: Db,
    lang: Lang,
    filter: ListFilter,
    today: string,
  ): Promise<{ rows: ListRow[]; more: boolean }>;
  empty(today: string): FormValues;
  load(db: Db, id: number): Promise<FormValues | null>;
  sections(db: Db, lang: Lang, t: Translate): Promise<Section[]>;
  parse(form: FormData, today: string): Parsed;
  remove(db: Db, adminId: string, id: number): Promise<RemoveResult>;
  /** Public page of a published record (for "View on site"). */
  publicPath(values: FormValues, lang: Lang): string | null;
}

/** The next id, so the record, its texts and the audit row can go in one batch. */
export async function nextId(db: Db, table: SQLiteTable & { id: unknown }): Promise<number> {
  const row = await db.get<{ next: number }>(
    sql`select coalesce(max(id), 0) + 1 as next from ${table}`,
  );
  return row?.next ?? 1;
}

/** Runs a batch of statements (D1 runs a batch as one transaction). */
export async function runBatch(db: Db, statements: BatchItem<'sqlite'>[]): Promise<void> {
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
}

/** Maps a D1 error to a form error: taken slug, a rule in the database, or the raw reason. */
export function dbErrors(error: unknown): FormErrors {
  const message = String((error as { message?: unknown })?.message ?? error);
  if (/UNIQUE constraint failed: \w+\.slug/i.test(message)) {
    return { slug: { key: 'admin.error.slugTaken' } };
  }
  if (/UNIQUE constraint failed: pathways\./i.test(message)) {
    return { to_program_id: { key: 'admin.error.pathwayExists' } };
  }
  // migrations/0001_pathway_rules.sql: from = pre-year, to = bachelor's.
  if (/pathway_levels/.test(message)) {
    return { to_program_id: { key: 'admin.error.pathwayLevels' } };
  }
  if (/UNIQUE constraint failed: \w+\.id|PRIMARY KEY/i.test(message)) {
    return { form: { key: 'admin.error.retry' } };
  }
  return { form: { key: 'admin.error.db', params: { reason: message.slice(0, 300) } } };
}

/** A failed delete: still pointed at by other records or by students' trackers. */
export function removeError(error: unknown): MessageKey {
  const message = String((error as { message?: unknown })?.message ?? error);
  return /FOREIGN KEY/i.test(message) ? 'admin.error.inUse' : 'admin.error.deleteFailed';
}
