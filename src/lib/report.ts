/**
 * "Report a mistake": validation, rate limit and storage, shared by the form
 * page (/[lang]/report, works without JavaScript) and /api/report (JSON).
 */
import { z } from 'zod';
import type { Lang } from '../i18n/config.ts';
import type { Db } from './db/client.ts';
import {
  findReportTarget,
  insertMistakeReport,
  REPORTABLE,
  type ReportTarget,
} from './db/catalog.ts';

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;

export const reportTargetSchema = z.object({
  type: z.enum(REPORTABLE),
  id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const reportSchema = reportTargetSchema.extend({
  message: z.string().trim().min(MESSAGE_MIN).max(MESSAGE_MAX),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(200).optional(),
});

export type ReportError = 'short' | 'long' | 'invalid' | 'notFound' | 'rate';

export type ReportResult =
  | { ok: true; target: ReportTarget }
  | { ok: false; error: ReportError; target: ReportTarget | null };

export interface ReportDeps {
  db: Db;
  lang: Lang;
  /** Returns false when this visitor is over the limit. */
  allow: () => Promise<boolean>;
}

export async function submitReport(input: unknown, deps: ReportDeps): Promise<ReportResult> {
  const target = reportTargetSchema.safeParse(input);
  if (!target.success) return { ok: false, error: 'invalid', target: null };
  const record = await findReportTarget(deps.db, deps.lang, target.data.type, target.data.id);
  if (!record) return { ok: false, error: 'notFound', target: null };

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === 'message');
    const error: ReportError =
      issue?.code === 'too_small' ? 'short' : issue?.code === 'too_big' ? 'long' : 'invalid';
    return { ok: false, error, target: record };
  }
  // A bot filled the hidden field: answer as if it worked, store nothing.
  if (parsed.data.website) return { ok: true, target: record };

  if (!(await deps.allow())) return { ok: false, error: 'rate', target: record };
  await insertMistakeReport(deps.db, {
    type: parsed.data.type,
    id: parsed.data.id,
    message: parsed.data.message,
  });
  return { ok: true, target: record };
}
