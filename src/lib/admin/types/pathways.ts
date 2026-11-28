/**
 * Pathways in /admin: a foundation or language program leading to a
 * bachelor's. The database refuses any other pair (migrations/0001).
 * A pathway shows wherever both programs are published.
 */
import { and, asc, eq, like, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { pathways, programs } from '../../db/schema.ts';
import { getTranslations } from '../../../i18n/index.ts';
import { auditInsert, diffOf } from '../audit.ts';
import { programOptions } from '../choices.ts';
import { flag, text, type FormErrors, type FormValues } from '../form.ts';
import {
  dbErrors,
  LIST_PAGE_SIZE,
  nextId,
  removeError,
  runBatch,
  type RecordType,
} from '../record-type.ts';

const fromProgram = alias(programs, 'from_program');
const toProgram = alias(programs, 'to_program');

export const pathwaysAdmin: RecordType = {
  type: 'pathways',
  pluralKey: 'admin.type.pathways',
  singularKey: 'admin.one.pathways',
  filters: ['q'],
  searchable: false,

  async list(db, lang, f) {
    const t = getTranslations(lang);
    const where: SQL[] = [];
    if (f.q) {
      const q = `%${f.q}%`;
      const match = or(
        like(fromProgram.name, q),
        like(toProgram.name, q),
        like(fromProgram.slug, q),
        like(toProgram.slug, q),
      );
      if (match) where.push(match);
    }
    const rows = await db
      .select({
        id: pathways.id,
        guaranteed: pathways.entryGuaranteed,
        from: fromProgram.name,
        fromLevel: fromProgram.level,
        to: toProgram.name,
        toSlug: toProgram.slug,
        toPublished: toProgram.published,
        fromPublished: fromProgram.published,
      })
      .from(pathways)
      .innerJoin(fromProgram, eq(fromProgram.id, pathways.fromProgramId))
      .innerJoin(toProgram, eq(toProgram.id, pathways.toProgramId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(toProgram.name), asc(fromProgram.name))
      .limit(LIST_PAGE_SIZE + 1)
      .offset((f.page - 1) * LIST_PAGE_SIZE);
    return {
      more: rows.length > LIST_PAGE_SIZE,
      rows: rows.slice(0, LIST_PAGE_SIZE).map((p) => ({
        id: p.id,
        title: `${p.from} → ${p.to}`,
        details: `${t(`level.${p.fromLevel}`)}${p.guaranteed ? ` · ${t('admin.field.entryGuaranteed')}` : ''}`,
        published: p.fromPublished && p.toPublished,
        lastChecked: null,
        stale: false,
        publicPath: p.toPublished ? `/programs/${p.toSlug}` : null,
      })),
    };
  },

  empty() {
    return { from_program_id: '', to_program_id: '', entry_guaranteed: false };
  },

  async load(db, id) {
    const [p] = await db.select().from(pathways).where(eq(pathways.id, id)).limit(1);
    if (!p) return null;
    return {
      from_program_id: String(p.fromProgramId),
      to_program_id: String(p.toProgramId),
      entry_guaranteed: p.entryGuaranteed,
    };
  },

  async sections(db, _lang, t) {
    return [
      {
        legend: 'admin.section.pathway',
        fields: [
          {
            kind: 'select',
            name: 'from_program_id',
            label: 'admin.field.fromProgram',
            options: await programOptions(db, t, 'pre'),
            blank: 'admin.choose',
            required: true,
          },
          {
            kind: 'select',
            name: 'to_program_id',
            label: 'admin.field.toProgram',
            options: await programOptions(db, t, 'bachelor'),
            blank: 'admin.choose',
            required: true,
          },
          {
            kind: 'checkbox',
            name: 'entry_guaranteed',
            label: 'admin.field.entryGuaranteed',
            hint: 'admin.hint.entryGuaranteed',
          },
        ],
      },
    ];
  },

  parse(form) {
    const values: FormValues = {
      from_program_id: text(form, 'from_program_id'),
      to_program_id: text(form, 'to_program_id'),
      entry_guaranteed: flag(form, 'entry_guaranteed'),
    };
    const errors: FormErrors = {};
    const from = Number(values['from_program_id']);
    const to = Number(values['to_program_id']);
    if (!Number.isInteger(from) || from <= 0)
      errors['from_program_id'] = { key: 'admin.error.required' };
    if (!Number.isInteger(to) || to <= 0) errors['to_program_id'] = { key: 'admin.error.required' };

    return {
      values,
      errors,
      async save(db, adminId, id, before) {
        const recordId = id ?? (await nextId(db, pathways));
        const row = {
          fromProgramId: from,
          toProgramId: to,
          entryGuaranteed: values['entry_guaranteed'] === true,
        };
        try {
          await runBatch(db, [
            id === null
              ? db.insert(pathways).values({ id: recordId, ...row })
              : db.update(pathways).set(row).where(eq(pathways.id, id)),
            auditInsert(db, {
              adminId,
              action: id === null ? 'create' : 'update',
              entityType: 'pathway',
              entityId: recordId,
              diff: diffOf(before, values),
            }),
          ]);
          return { ok: true, id: recordId };
        } catch (error) {
          return { ok: false, errors: dbErrors(error) };
        }
      },
    };
  },

  async remove(db, adminId, id) {
    try {
      await runBatch(db, [
        db.delete(pathways).where(eq(pathways.id, id)),
        auditInsert(db, { adminId, action: 'delete', entityType: 'pathway', entityId: id }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: removeError(error) };
    }
  },

  publicPath() {
    return null;
  },
};
