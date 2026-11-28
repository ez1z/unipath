/**
 * A fresh in-memory local D1 for each test file: wrangler's getPlatformProxy with
 * persist off and remote bindings off, migrated with the real files in migrations/.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { createDb, type Db } from '../../../src/lib/db/client.ts';
import { loadDemoData } from '../../../scripts/load-demo-data.ts';
import { buildDemoData } from '../../../scripts/seed-data.ts';

const root = new URL('../../../', import.meta.url);
const migrationsDir = new URL('migrations/', root);

/** A fixed "today" so deadlines and "closed" don't depend on the clock. */
export const TODAY = '2026-12-01';

export interface TestDb {
  d1: D1Database;
  db: Db;
  /** The local (in-memory) R2 bucket and KV namespace of the same proxy. */
  files: R2Bucket;
  kv: KVNamespace;
  dispose: () => Promise<void>;
}

/** Statements of every migration file, in order, split the way drizzle-kit writes them. */
export function migrationStatements(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) =>
      readFileSync(new URL(name, migrationsDir), 'utf8')
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean),
    );
}

export async function createTestDb({ seed = true } = {}): Promise<TestDb> {
  const proxy = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL('wrangler.jsonc', root)),
    persist: false,
    remoteBindings: false,
  });
  const d1 = proxy.env.DB;
  await d1.batch(migrationStatements().map((statement) => d1.prepare(statement)));
  const db = createDb(d1);
  if (seed) await loadDemoData(db, buildDemoData(TODAY));
  return { d1, db, files: proxy.env.FILES, kv: proxy.env.KV, dispose: () => proxy.dispose() };
}
