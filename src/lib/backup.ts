/**
 * Nightly D1 backup to R2 (SPEC: `backups/YYYY-MM-DD.sql`, keep the last 30).
 *
 * The file is plain SQL that `wrangler d1 execute <db> --file` can load into an
 * EMPTY database (DEPLOY.md, "Restore a backup"):
 *
 * 1. tables (and FTS virtual tables) are created,
 * 2. rows are inserted (foreign keys are checked at the end),
 * 3. indexes and triggers are created after the data, so triggers don't fire
 *    twice, and the external-content thread index is rebuilt from `threads`.
 *
 * Left out: Cloudflare's own `_cf_*` tables, FTS shadow tables (FTS makes them),
 * and the rows of `session` and `verification` (sign-in sessions and codes:
 * short-lived, and not worth keeping in a file). Everyone signs in again
 * after a restore.
 */

export const BACKUP_PREFIX = 'backups/';
export const BACKUPS_KEPT = 30;
export const BACKUP_CRON = '0 23 * * *';

/** Tables whose rows are never written to a backup. */
const SKIP_ROWS = new Set(['session', 'verification']);
const FTS_SHADOW = /_(data|idx|content|docsize|config)$/;

interface MasterRow {
  type: 'table' | 'index' | 'trigger' | 'view';
  name: string;
  tbl_name: string;
  sql: string | null;
}

const quoteName = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** One SQL literal: NULL, a number, a quoted string or a blob. */
export function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes =
      value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `X'${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}'`;
  }
  if (Array.isArray(value)) return sqlValue(new Uint8Array(value as number[]));
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** The whole database as SQL text. */
export async function dumpDatabase(db: D1Database, now: Date = new Date()): Promise<string> {
  const { results } = await db
    .prepare(
      `SELECT type, name, tbl_name, sql FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
       ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 WHEN 'index' THEN 2 ELSE 3 END, rowid`,
    )
    .all<MasterRow>();

  const virtual = results.filter(
    (r) => r.type === 'table' && /^CREATE VIRTUAL TABLE/i.test(r.sql ?? ''),
  );
  const isShadow = (name: string) =>
    virtual.some((v) => name.startsWith(`${v.name}_`) && FTS_SHADOW.test(name));
  const tables = results.filter((r) => r.type === 'table' && r.sql && !isShadow(r.name));

  const out: string[] = [
    `-- Clavis D1 backup, ${now.toISOString()}`,
    '-- Load into an EMPTY database: wrangler d1 execute <db> --remote --file <this file>',
    'PRAGMA defer_foreign_keys = on;',
    '',
  ];
  for (const table of tables) out.push(`${table.sql};`);
  out.push('');

  for (const table of tables) {
    if (SKIP_ROWS.has(table.name)) continue;
    const isVirtual = virtual.includes(table);
    // External-content FTS (thread_search) is rebuilt from its table below.
    if (isVirtual && /content\s*=/i.test(table.sql ?? '')) continue;
    const select = isVirtual
      ? `SELECT rowid, * FROM ${quoteName(table.name)}`
      : `SELECT * FROM ${quoteName(table.name)}`;
    const [columns, ...rows] = await db.prepare(select).raw({ columnNames: true });
    if (!columns || rows.length === 0) continue;
    const head = `INSERT INTO ${quoteName(table.name)} (${(columns as string[]).map(quoteName).join(', ')}) VALUES`;
    for (const row of rows) out.push(`${head} (${row.map(sqlValue).join(', ')});`);
  }
  out.push('');

  for (const r of results) {
    if ((r.type === 'index' || r.type === 'trigger' || r.type === 'view') && r.sql) {
      out.push(`${r.sql};`);
    }
  }
  for (const v of virtual) {
    if (/content\s*=/i.test(v.sql ?? '')) {
      out.push(`INSERT INTO ${quoteName(v.name)} (${quoteName(v.name)}) VALUES ('rebuild');`);
    }
  }
  out.push('');
  return out.join('\n');
}

/** Writes today's backup and deletes all but the newest 30. */
export async function runBackup(
  db: D1Database,
  files: R2Bucket,
  today: string,
): Promise<{ key: string; bytes: number; deleted: string[] }> {
  const sql = await dumpDatabase(db);
  const key = `${BACKUP_PREFIX}${today}.sql`;
  const body = new TextEncoder().encode(sql);
  await files.put(key, body, {
    httpMetadata: { contentType: 'application/sql; charset=utf-8' },
  });

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await files.list({ prefix: BACKUP_PREFIX, ...(cursor ? { cursor } : {}) });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  // YYYY-MM-DD names sort by date.
  const deleted = keys.sort().reverse().slice(BACKUPS_KEPT);
  if (deleted.length > 0) await files.delete(deleted);
  return { key, bytes: body.length, deleted };
}
