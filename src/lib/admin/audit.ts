/**
 * Every admin write leaves an audit_log row (SPEC: "Audit log of every admin
 * write"), with a diff of the fields that changed.
 */
import { desc, eq, and, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { auditLog } from '../db/schema.ts';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'resolve'
  | 'dismiss'
  | 'restore'
  | 'hide'
  | 'approve'
  | 'reject'
  | 'grant'
  | 'revoke'
  | 'upload'
  | 'settings'
  | 'import';

export interface AuditEntry {
  adminId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | number;
  diff?: Record<string, unknown> | null;
}

/** `{ field: [before, after] }` for every field whose value changed. */
export function diffOf(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after)])) {
    const a = before?.[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = [a, b];
  }
  return out;
}

/** The insert, for a D1 batch with the write it describes. */
export function auditInsert(db: Db, entry: AuditEntry) {
  return db.insert(auditLog).values({
    adminId: entry.adminId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: String(entry.entityId),
    diff: entry.diff ?? null,
  });
}

export const AUDIT_PAGE_SIZE = 100;

export async function listAudit(
  db: Db,
  filter: { entityType?: string | null; entityId?: string | null; page?: number } = {},
) {
  const conditions: SQL[] = [];
  if (filter.entityType) conditions.push(eq(auditLog.entityType, filter.entityType));
  if (filter.entityId) conditions.push(eq(auditLog.entityId, filter.entityId));
  const page = Math.max(1, filter.page ?? 1);
  return db
    .select()
    .from(auditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE + 1)
    .offset((page - 1) * AUDIT_PAGE_SIZE);
}
