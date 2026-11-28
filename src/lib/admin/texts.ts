/**
 * Turkmen and Russian texts of a record, for the admin forms. English stays in
 * the record's own column. An empty field removes the translation, so the
 * public page shows "Not translated yet" and the English text.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../db/client.ts';
import { translations } from '../db/schema.ts';
import type { EntityType } from '../db/values.ts';
import { lines } from './form.ts';

export type OtherLang = 'tk' | 'ru';
export const OTHER_LANGS: readonly OtherLang[] = ['tk', 'ru'];

export async function readTexts(
  db: Db,
  entityType: EntityType,
  entityId: string | number,
  fields: string[],
): Promise<Record<string, Record<OtherLang, string>>> {
  const rows = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.entityType, entityType),
        eq(translations.entityId, String(entityId)),
        inArray(translations.lang, [...OTHER_LANGS]),
        inArray(translations.field, fields),
      ),
    );
  const out: Record<string, Record<OtherLang, string>> = {};
  for (const field of fields) out[field] = { tk: '', ru: '' };
  for (const row of rows) {
    const slot = out[row.field];
    if (slot && (row.lang === 'tk' || row.lang === 'ru')) slot[row.lang] = row.text;
  }
  return out;
}

/** A list field (eligibility) is stored as a JSON array; the form shows one item per line. */
export function listTextToLines(value: string): string {
  if (!value) return '';
  try {
    const items = JSON.parse(value) as unknown;
    return Array.isArray(items) ? items.filter((i) => typeof i === 'string').join('\n') : value;
  } catch {
    return value;
  }
}

/** Upserts or deletes the tk and ru rows of one field. */
export function textStatements(
  db: Db,
  entityType: EntityType,
  entityId: string | number,
  field: string,
  values: Record<OtherLang, string>,
  { list = false }: { list?: boolean } = {},
): BatchItem<'sqlite'>[] {
  const id = String(entityId);
  return OTHER_LANGS.map((lang) => {
    const raw = values[lang].trim();
    const stored = list ? (lines(raw).length ? JSON.stringify(lines(raw)) : '') : raw;
    const where = and(
      eq(translations.entityType, entityType),
      eq(translations.entityId, id),
      eq(translations.lang, lang),
      eq(translations.field, field),
    );
    if (!stored) return db.delete(translations).where(where);
    return db
      .insert(translations)
      .values({ entityType, entityId: id, lang, field, text: stored })
      .onConflictDoUpdate({
        target: [
          translations.entityType,
          translations.entityId,
          translations.lang,
          translations.field,
        ],
        set: { text: stored },
      });
  });
}

/** All texts of a deleted record. */
export function deleteTexts(db: Db, entityType: EntityType, entityId: string | number) {
  return db
    .delete(translations)
    .where(
      and(eq(translations.entityType, entityType), eq(translations.entityId, String(entityId))),
    );
}
