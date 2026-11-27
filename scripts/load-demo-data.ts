/**
 * Writes the demo data into a D1 database in one batch (D1 runs a batch as a
 * single transaction, so a failed seed leaves the old data in place).
 * Catalogue tables are replaced; countries, topics and settings are upserted so
 * rows that point at them later (threads → topics) keep working.
 */
import { getTableColumns, inArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Db } from '../src/lib/db/client.ts';
import {
  countries,
  pathwayColleges,
  pathways,
  programs,
  scholarshipPrograms,
  scholarships,
  scholarshipUniversities,
  settings,
  topics,
  translations,
  universities,
} from '../src/lib/db/schema.ts';
import { ENTITY_TYPES } from '../src/lib/db/values.ts';
import type { DemoData } from './seed-data.ts';

/** D1 allows at most 100 bound parameters per statement. */
const MAX_PARAMS = 100;

function chunks<T>(rows: T[], table: SQLiteTable): T[][] {
  const size = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(getTableColumns(table)).length));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function loadDemoData(db: Db, data: DemoData): Promise<Record<string, number>> {
  const statements: BatchItem<'sqlite'>[] = [
    // Children first, so foreign keys hold at every step.
    db.delete(scholarshipPrograms),
    db.delete(scholarshipUniversities),
    db.delete(pathways),
    db.delete(programs),
    db.delete(scholarships),
    db.delete(universities),
    db.delete(pathwayColleges),
    db.delete(translations).where(inArray(translations.entityType, ENTITY_TYPES)),
  ];

  for (const rows of chunks(data.countries, countries)) {
    statements.push(
      db
        .insert(countries)
        .values(rows)
        .onConflictDoUpdate({
          target: countries.code,
          set: { popularRank: sql`excluded.popular_rank` },
        }),
    );
  }
  for (const rows of chunks(data.topics, topics)) {
    statements.push(
      db
        .insert(topics)
        .values(rows)
        .onConflictDoUpdate({ target: topics.slug, set: { sort: sql`excluded.sort` } }),
    );
  }
  for (const rows of chunks(data.settings, settings)) {
    statements.push(
      db
        .insert(settings)
        .values(rows)
        .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value` } }),
    );
  }

  const inserts = [
    [universities, data.universities],
    [pathwayColleges, data.pathwayColleges],
    [programs, data.programs],
    [pathways, data.pathways],
    [scholarships, data.scholarships],
    [scholarshipPrograms, data.scholarshipPrograms],
    [scholarshipUniversities, data.scholarshipUniversities],
    [translations, data.translations],
  ] as const;
  for (const [table, rows] of inserts) {
    for (const part of chunks<(typeof rows)[number]>([...rows], table)) {
      statements.push(db.insert(table).values(part as never));
    }
  }

  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);

  return Object.fromEntries(
    Object.entries(data).map(([name, rows]) => [name, (rows as unknown[]).length]),
  );
}
