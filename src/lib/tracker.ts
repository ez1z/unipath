/**
 * The application tracker: tracking a program, pathway or scholarship, its
 * pre-filled checklist, stages, deadlines and notes, and read-only share links
 * for parents. Plain functions over the Db, unit tested against the local D1.
 *
 * Every read and write is scoped to the signed-in user (`user_id = ?`), so one
 * student can never see or change another's items by guessing an id.
 */
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import * as z from 'zod';
import { LANGS, type Lang } from '../i18n/config.ts';
import type { MessageKey, Translate } from '../i18n/index.ts';
import { addDays, daysBetween } from './dates.ts';
import type { Db } from './db/client.ts';
import {
  COLLEGE_KEYS,
  loadTexts,
  mainVisible,
  mergeRequests,
  pick,
  PROGRAM_KEYS,
  textRequest,
  toProvider,
  UNIVERSITY_KEYS,
  type LocalText,
} from './db/queries.ts';
import {
  pathwayColleges,
  pathways,
  profiles,
  programs,
  scholarships,
  shareLinks,
  trackerItems,
  trackerTasks,
  universities,
  type ProgramRequirements,
} from './db/schema.ts';
import { DOCUMENTS, TRACKER_STAGES, type ProgramLevel, type TrackerStage } from './db/values.ts';
import { formatNumber } from './format.ts';
import { totalYears } from './paths.ts';

// ---------------------------------------------------------------------------
// Targets, stages, limits
// ---------------------------------------------------------------------------

export const TRACK_TYPES = ['program', 'pathway', 'scholarship'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const trackTargetSchema = z.object({ type: z.enum(TRACK_TYPES), id: idSchema });
export type TrackTarget = z.infer<typeof trackTargetSchema>;

/** Stages before the application is sent: reminders go out only for these. */
export const OPEN_STAGES = ['planning', 'preparing'] as const satisfies readonly TrackerStage[];

export const isOpenStage = (stage: TrackerStage) =>
  (OPEN_STAGES as readonly TrackerStage[]).includes(stage);

/** The four board columns; the last holds every decision. */
export const BOARD_COLUMNS = [
  { key: 'planning', stages: ['planning'] },
  { key: 'preparing', stages: ['preparing'] },
  { key: 'submitted', stages: ['submitted'] },
  { key: 'decision', stages: ['accepted', 'waitlisted', 'rejected', 'enrolled'] },
] as const satisfies readonly { key: string; stages: readonly TrackerStage[] }[];
export type BoardColumnKey = (typeof BOARD_COLUMNS)[number]['key'];

export function columnOf(stage: TrackerStage): BoardColumnKey {
  const column = BOARD_COLUMNS.find((c) => (c.stages as readonly TrackerStage[]).includes(stage));
  return column?.key ?? 'planning';
}

/** A student applies to a handful of places; these stop runaway scripts, not people. */
export const MAX_ITEMS = 60;
export const MAX_TASKS = 40;
export const MAX_NOTES = 2000;
export const MAX_TASK_TITLE = 120;
export const MAX_SHARE_LINKS = 20;
export const SHARE_DAYS = 90;

export const stageSchema = z.enum(TRACKER_STAGES);
export const notesSchema = z
  .string()
  .max(MAX_NOTES * 2)
  .transform((s) => s.replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().max(MAX_NOTES))
  .transform((s) => (s === '' ? null : s));
export const taskTitleSchema = z.string().trim().min(1).max(MAX_TASK_TITLE);
/** `YYYY-MM-DD`, or empty to go back to the record's own deadline. */
export const deadlineSchema = z.union([
  z.literal('').transform(() => null),
  z.iso.date(),
  z.null(),
]);

// ---------------------------------------------------------------------------
// Pre-filled checklist
// ---------------------------------------------------------------------------

/**
 * Codes of pre-filled tasks, so a task shows in the reader's language:
 * `doc:passport`, `ielts:6.5`, `test:SAT:1200` (or `test:SAT:`), `apply:program`,
 * `apply:pre-year`, `progress:bachelor`, `eligibility`, `apply:scholarship`.
 */
export interface NewTask {
  code: string;
  title: string;
}

function requirementTasks(r: ProgramRequirements): NewTask[] {
  const tasks: NewTask[] = [];
  if (r.ieltsMin !== null) {
    tasks.push({ code: `ielts:${r.ieltsMin}`, title: `Get IELTS ${r.ieltsMin} or higher` });
  }
  for (const test of r.otherTests) {
    const name = test.name.replaceAll(':', ' ').slice(0, 40);
    const min = (test.min ?? '').replaceAll(':', ' ').slice(0, 20);
    tasks.push({
      code: `test:${name}:${min}`,
      title: min ? `Get ${name} ${min} or higher` : `Take the ${name}`,
    });
  }
  for (const doc of r.documents) {
    tasks.push({ code: `doc:${doc}`, title: doc.replaceAll('_', ' ') });
  }
  return tasks;
}

export function programTasks(requirements: ProgramRequirements): NewTask[] {
  return [
    ...requirementTasks(requirements),
    { code: 'apply:program', title: 'Send the application' },
  ];
}

/** A pathway: the pre-year's requirements and application, then moving on to the bachelor's. */
export function pathwayTasks(preYear: ProgramRequirements): NewTask[] {
  return [
    ...requirementTasks(preYear),
    { code: 'apply:pre-year', title: 'Send the pre-year application' },
    { code: 'progress:bachelor', title: "Move on to the bachelor's" },
  ];
}

export function scholarshipTasks(): NewTask[] {
  return [
    { code: 'eligibility', title: 'Check every eligibility point' },
    { code: 'apply:scholarship', title: 'Send the scholarship application' },
  ];
}

/** A task in the reader's language: from its code, else the student's own title. */
export function taskLabel(
  t: Translate,
  lang: Lang,
  task: { code: string | null; title: string },
): string {
  const code = task.code;
  if (!code) return task.title;
  const [kind, a = '', b = ''] = code.split(':');
  switch (kind) {
    case 'doc':
      return (DOCUMENTS as readonly string[]).includes(a)
        ? t(`doc.${a}` as MessageKey)
        : task.title;
    case 'ielts': {
      const score = Number(a);
      return Number.isFinite(score)
        ? t('task.ielts', { score: formatNumber(lang, score) })
        : task.title;
    }
    case 'test':
      return b ? t('task.testMin', { name: a, min: b }) : t('task.test', { name: a });
    case 'apply':
      if (a === 'program') return t('task.applyProgram');
      if (a === 'pre-year') return t('task.applyPreYear');
      if (a === 'scholarship') return t('task.applyScholarship');
      return task.title;
    case 'progress':
      return t('task.progressBachelor');
    case 'eligibility':
      return t('task.eligibility');
    default:
      return task.title;
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface TrackerStep {
  level: ProgramLevel;
  name: LocalText;
  provider: LocalText;
  years: number;
  /** Public path without the language, e.g. `/programs/demo-cs`; null once unpublished. */
  path: string | null;
  deadline: string | null;
}

export interface TrackerItemView {
  id: number;
  type: TrackType;
  stage: TrackerStage;
  notes: string | null;
  name: LocalText;
  /** University or college; the scholarship's provider. */
  provider: LocalText | null;
  /** Public page of the record; null once it is no longer published. */
  path: string | null;
  /** Program and pathway items: their steps, pre-year first. Empty for scholarships. */
  steps: TrackerStep[];
  totalYears: number | null;
  /** The record's own deadline (a pathway's is its first step's). */
  sourceDeadline: string | null;
  rolling: boolean;
  /** The one that counts: the student's own date, else the record's. */
  deadline: string | null;
  deadlineOverridden: boolean;
  done: number;
  total: number;
  updatedAt: Date;
}

export interface TrackerTaskView {
  id: number;
  code: string | null;
  title: string;
  done: boolean;
}

type ItemRow = typeof trackerItems.$inferSelect;

/** Builds views for a user's rows: one query per kind of record, all by primary key. */
async function buildViews(db: Db, lang: Lang, rows: ItemRow[]): Promise<TrackerItemView[]> {
  if (rows.length === 0) return [];
  const pathwayIds = rows.flatMap((r) => (r.pathwayId ? [r.pathwayId] : []));
  const scholarshipIds = rows.flatMap((r) => (r.scholarshipId ? [r.scholarshipId] : []));
  const itemIds = rows.map((r) => r.id);

  const [pathwayRows, scholarshipRows, counts] = await Promise.all([
    pathwayIds.length
      ? db
          .select({
            id: pathways.id,
            from: pathways.fromProgramId,
            to: pathways.toProgramId,
          })
          .from(pathways)
          .where(inArray(pathways.id, pathwayIds))
      : [],
    scholarshipIds.length
      ? db
          .select({
            id: scholarships.id,
            slug: scholarships.slug,
            name: scholarships.name,
            provider: scholarships.provider,
            deadline: scholarships.deadline,
            rolling: scholarships.rolling,
            published: scholarships.published,
          })
          .from(scholarships)
          .where(inArray(scholarships.id, scholarshipIds))
      : [],
    db
      .select({
        itemId: trackerTasks.itemId,
        total: sql<number>`count(*)`,
        done: sql<number>`coalesce(sum(${trackerTasks.done}), 0)`,
      })
      .from(trackerTasks)
      .where(inArray(trackerTasks.itemId, itemIds))
      .groupBy(trackerTasks.itemId),
  ]);

  const programIds = [
    ...rows.flatMap((r) => (r.programId ? [r.programId] : [])),
    ...pathwayRows.flatMap((p) => [p.from, p.to]),
  ];
  const programRows = programIds.length
    ? await db
        .select({
          program: pick(programs, [...PROGRAM_KEYS, 'published'] as const),
          university: pick(universities, [...UNIVERSITY_KEYS, 'published'] as const),
          college: pick(pathwayColleges, [...COLLEGE_KEYS, 'published'] as const),
        })
        .from(programs)
        .leftJoin(universities, eq(universities.id, programs.universityId))
        .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
        .where(inArray(programs.id, [...new Set(programIds)]))
    : [];

  const texts = await loadTexts(
    db,
    lang,
    mergeRequests(textRequest(programRows), { scholarship: scholarshipRows.map((s) => s.id) }),
    ['name'],
  );

  const stepOf = new Map<number, TrackerStep>();
  for (const row of programRows) {
    const listed =
      row.program.published && Boolean(row.university?.published ?? row.college?.published);
    const provider = toProvider(row.university, row.college, texts);
    stepOf.set(row.program.id, {
      level: row.program.level,
      name: texts.name('program', row.program.id, row.program.name),
      provider: provider.name,
      years: row.program.durationYears,
      path: listed ? `/programs/${row.program.slug}` : null,
      deadline: row.program.applicationDeadline,
    });
  }
  const pathwayOf = new Map(pathwayRows.map((p) => [p.id, p]));
  const scholarshipOf = new Map(scholarshipRows.map((s) => [s.id, s]));
  const countOf = new Map(counts.map((c) => [c.itemId, c]));

  const views: TrackerItemView[] = [];
  for (const row of rows) {
    let type: TrackType;
    let steps: TrackerStep[] = [];
    let name: LocalText | null = null;
    let provider: LocalText | null = null;
    let path: string | null = null;
    let sourceDeadline: string | null = null;
    let rolling = false;
    let years: number | null = null;

    if (row.pathwayId) {
      type = 'pathway';
      const link = pathwayOf.get(row.pathwayId);
      const pre = link && stepOf.get(link.from);
      const bach = link && stepOf.get(link.to);
      if (pre && bach) {
        steps = [pre, bach];
        name = bach.name;
        provider = bach.provider;
        path = bach.path;
        sourceDeadline = pre.deadline;
        years = totalYears(pre.years, bach.years);
      }
    } else if (row.programId) {
      type = 'program';
      const step = stepOf.get(row.programId);
      if (step) {
        steps = [step];
        name = step.name;
        provider = step.provider;
        path = step.path;
        sourceDeadline = step.deadline;
        years = step.level === 'bachelor' ? totalYears(null, step.years) : null;
      }
    } else {
      type = 'scholarship';
      const s = row.scholarshipId ? scholarshipOf.get(row.scholarshipId) : undefined;
      if (s) {
        name = texts.name('scholarship', s.id, s.name);
        provider = { text: s.provider, fallback: false };
        path = s.published ? `/scholarships/${s.slug}` : null;
        sourceDeadline = s.rolling ? null : s.deadline;
        rolling = s.rolling;
      }
    }
    // The record itself was deleted (admins unpublish rather than delete, but be safe).
    if (!name) continue;
    const count = countOf.get(row.id);
    views.push({
      id: row.id,
      type,
      stage: row.stage,
      notes: row.notes,
      name,
      provider,
      path,
      steps,
      totalYears: years,
      sourceDeadline,
      rolling,
      deadline: row.deadlineOverride ?? sourceDeadline,
      deadlineOverridden: row.deadlineOverride !== null,
      done: Number(count?.done ?? 0),
      total: Number(count?.total ?? 0),
      updatedAt: row.updatedAt,
    });
  }
  return views;
}

/** Nearest deadline first; items without one last. */
export function byDeadline(a: TrackerItemView, b: TrackerItemView): number {
  return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.id - b.id;
}

/** A user's items (the tracker_items(user_id) index). */
export async function listTracker(db: Db, userId: string, lang: Lang): Promise<TrackerItemView[]> {
  const rows = await db
    .select()
    .from(trackerItems)
    .where(eq(trackerItems.userId, userId))
    .limit(MAX_ITEMS);
  return (await buildViews(db, lang, rows)).sort(byDeadline);
}

/** The open item with the nearest deadline from today on, for the banner and the Home card. */
export function nextDeadline(items: TrackerItemView[], today: string): TrackerItemView | null {
  return (
    items
      .filter((i) => isOpenStage(i.stage) && i.deadline !== null && i.deadline >= today)
      .sort(byDeadline)[0] ?? null
  );
}

export function daysLeft(item: { deadline: string | null }, today: string): number | null {
  return item.deadline === null ? null : daysBetween(today, item.deadline);
}

export async function listTasks(db: Db, itemId: number): Promise<TrackerTaskView[]> {
  return db
    .select({
      id: trackerTasks.id,
      code: trackerTasks.code,
      title: trackerTasks.title,
      done: trackerTasks.done,
    })
    .from(trackerTasks)
    .where(eq(trackerTasks.itemId, itemId))
    .orderBy(asc(trackerTasks.sort), asc(trackerTasks.id));
}

/** One item with its checklist, only if it belongs to the user. */
export async function getTrackerItem(
  db: Db,
  userId: string,
  itemId: number,
  lang: Lang,
): Promise<{ item: TrackerItemView; tasks: TrackerTaskView[] } | null> {
  const rows = await db
    .select()
    .from(trackerItems)
    .where(and(eq(trackerItems.id, itemId), eq(trackerItems.userId, userId)))
    .limit(1);
  const [item] = await buildViews(db, lang, rows);
  if (!item) return null;
  return { item, tasks: await listTasks(db, item.id) };
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

const targetColumn = {
  program: trackerItems.programId,
  pathway: trackerItems.pathwayId,
  scholarship: trackerItems.scholarshipId,
} as const;

/** The pre-filled tasks for a published target, or null if it isn't published. */
async function tasksForTarget(db: Db, target: TrackTarget): Promise<NewTask[] | null> {
  if (target.type === 'scholarship') {
    const [row] = await db
      .select({ id: scholarships.id })
      .from(scholarships)
      .where(and(eq(scholarships.id, target.id), eq(scholarships.published, true)))
      .limit(1);
    return row ? scholarshipTasks() : null;
  }
  if (target.type === 'program') {
    const [row] = await db
      .select({ requirements: programs.requirements })
      .from(programs)
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(and(eq(programs.id, target.id), mainVisible))
      .limit(1);
    return row ? programTasks(row.requirements) : null;
  }
  const [link] = await db
    .select({ from: pathways.fromProgramId, to: pathways.toProgramId })
    .from(pathways)
    .where(eq(pathways.id, target.id))
    .limit(1);
  if (!link) return null;
  const visible = await db
    .select({ id: programs.id, requirements: programs.requirements })
    .from(programs)
    .leftJoin(universities, eq(universities.id, programs.universityId))
    .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
    .where(and(inArray(programs.id, [link.from, link.to]), mainVisible));
  const pre = visible.find((p) => p.id === link.from);
  if (!pre || !visible.some((p) => p.id === link.to)) return null;
  return pathwayTasks(pre.requirements);
}

export type TrackResult =
  { ok: true; id: number; created: boolean } | { ok: false; error: 'notFound' | 'limit' };

/** "Track this": a new item in Planning with its checklist, or the one already tracked. */
export async function trackTarget(
  db: Db,
  userId: string,
  target: TrackTarget,
): Promise<TrackResult> {
  const mine = await db
    .select({ id: trackerItems.id, target: targetColumn[target.type] })
    .from(trackerItems)
    .where(eq(trackerItems.userId, userId))
    .limit(MAX_ITEMS + 1);
  const existing = mine.find((row) => row.target === target.id);
  if (existing) return { ok: true, id: existing.id, created: false };
  if (mine.length >= MAX_ITEMS) return { ok: false, error: 'limit' };

  const tasks = await tasksForTarget(db, target);
  if (!tasks) return { ok: false, error: 'notFound' };

  const [item] = await db
    .insert(trackerItems)
    .values({
      userId,
      stage: 'planning',
      programId: target.type === 'program' ? target.id : null,
      pathwayId: target.type === 'pathway' ? target.id : null,
      scholarshipId: target.type === 'scholarship' ? target.id : null,
    })
    .onConflictDoNothing()
    .returning({ id: trackerItems.id });
  if (!item) {
    // A second tap won the race: it already made the item and its checklist.
    const [raced] = await db
      .select({ id: trackerItems.id })
      .from(trackerItems)
      .where(and(eq(trackerItems.userId, userId), eq(targetColumn[target.type], target.id)))
      .limit(1);
    if (!raced) throw new Error('tracker item insert returned nothing');
    return { ok: true, id: raced.id, created: false };
  }
  if (tasks.length > 0) {
    await db
      .insert(trackerTasks)
      .values(tasks.map((task, i) => ({ itemId: item.id, ...task, sort: i })));
  }
  return { ok: true, id: item.id, created: true };
}

const mineWhere = (userId: string, itemId: number) =>
  and(eq(trackerItems.id, itemId), eq(trackerItems.userId, userId));

const touched = () => ({ updatedAt: new Date() });

/** Changes one field of the user's own item; false if it isn't theirs. */
async function updateItem(
  db: Db,
  userId: string,
  itemId: number,
  values: Partial<Pick<ItemRow, 'stage' | 'notes' | 'deadlineOverride'>>,
): Promise<boolean> {
  const rows = await db
    .update(trackerItems)
    .set({ ...values, ...touched() })
    .where(mineWhere(userId, itemId))
    .returning({ id: trackerItems.id });
  return rows.length > 0;
}

export const setStage = (db: Db, userId: string, itemId: number, stage: TrackerStage) =>
  updateItem(db, userId, itemId, { stage });

export const setNotes = (db: Db, userId: string, itemId: number, notes: string | null) =>
  updateItem(db, userId, itemId, { notes });

export const setDeadline = (db: Db, userId: string, itemId: number, deadline: string | null) =>
  updateItem(db, userId, itemId, { deadlineOverride: deadline });

/** Stops tracking: the item, its tasks, its share link and reminder log (cascade). */
export async function deleteItem(db: Db, userId: string, itemId: number): Promise<boolean> {
  const rows = await db
    .delete(trackerItems)
    .where(mineWhere(userId, itemId))
    .returning({ id: trackerItems.id });
  return rows.length > 0;
}

async function ownsItem(db: Db, userId: string, itemId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: trackerItems.id })
    .from(trackerItems)
    .where(mineWhere(userId, itemId))
    .limit(1);
  return row !== undefined;
}

export async function setTaskDone(
  db: Db,
  userId: string,
  itemId: number,
  taskId: number,
  done: boolean,
): Promise<boolean> {
  if (!(await ownsItem(db, userId, itemId))) return false;
  const rows = await db
    .update(trackerTasks)
    .set({ done })
    .where(and(eq(trackerTasks.id, taskId), eq(trackerTasks.itemId, itemId)))
    .returning({ id: trackerTasks.id });
  if (rows.length > 0) await updateItem(db, userId, itemId, {});
  return rows.length > 0;
}

export async function addTask(
  db: Db,
  userId: string,
  itemId: number,
  title: string,
): Promise<'ok' | 'notFound' | 'limit'> {
  if (!(await ownsItem(db, userId, itemId))) return 'notFound';
  const [count] = await db
    .select({ n: sql<number>`count(*)`, last: sql<number | null>`max(${trackerTasks.sort})` })
    .from(trackerTasks)
    .where(eq(trackerTasks.itemId, itemId));
  if (Number(count?.n ?? 0) >= MAX_TASKS) return 'limit';
  await db
    .insert(trackerTasks)
    .values({ itemId, title, code: null, sort: Number(count?.last ?? -1) + 1 });
  await updateItem(db, userId, itemId, {});
  return 'ok';
}

export async function deleteTask(
  db: Db,
  userId: string,
  itemId: number,
  taskId: number,
): Promise<boolean> {
  if (!(await ownsItem(db, userId, itemId))) return false;
  const rows = await db
    .delete(trackerTasks)
    .where(and(eq(trackerTasks.id, taskId), eq(trackerTasks.itemId, itemId)))
    .returning({ id: trackerTasks.id });
  if (rows.length > 0) await updateItem(db, userId, itemId, {});
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Share with parents
// ---------------------------------------------------------------------------

export const shareCreateSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('tracker'), lang: z.enum(LANGS) }),
  z.object({ scope: z.literal('item'), itemId: idSchema, lang: z.enum(LANGS) }),
]);
export type ShareCreate = z.infer<typeof shareCreateSchema>;

/** 32 random bytes, base64url: unguessable, and fine in a URL. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export const shareTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .max(43);

export interface ShareLinkView {
  token: string;
  scope: 'tracker' | 'item';
  itemId: number | null;
  lang: Lang;
  expiresAt: Date;
}

export async function listShareLinks(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<ShareLinkView[]> {
  return db
    .select({
      token: shareLinks.token,
      scope: shareLinks.scope,
      itemId: shareLinks.itemId,
      lang: shareLinks.lang,
      expiresAt: shareLinks.expiresAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.userId, userId), gt(shareLinks.expiresAt, now)))
    .orderBy(asc(shareLinks.expiresAt))
    .limit(MAX_SHARE_LINKS);
}

export async function createShareLink(
  db: Db,
  userId: string,
  input: ShareCreate,
  now: Date = new Date(),
): Promise<{ ok: true; token: string } | { ok: false; error: 'notFound' | 'limit' }> {
  const itemId = input.scope === 'item' ? input.itemId : null;
  if (itemId !== null && !(await ownsItem(db, userId, itemId))) {
    return { ok: false, error: 'notFound' };
  }
  // Expired links are useless; clear them so they don't count against the limit.
  await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.userId, userId), sql`${shareLinks.expiresAt} <= ${now.getTime()}`));
  if ((await listShareLinks(db, userId, now)).length >= MAX_SHARE_LINKS) {
    return { ok: false, error: 'limit' };
  }
  const token = newShareToken();
  await db.insert(shareLinks).values({
    token,
    userId,
    scope: input.scope,
    itemId,
    lang: input.lang,
    expiresAt: new Date(now.getTime() + SHARE_DAYS * 86_400_000),
  });
  return { ok: true, token };
}

export async function revokeShareLink(db: Db, userId: string, token: string): Promise<boolean> {
  const rows = await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.token, token), eq(shareLinks.userId, userId)))
    .returning({ token: shareLinks.token });
  return rows.length > 0;
}

export interface SharedView {
  lang: Lang;
  /** The student's nickname, if they set one. */
  nickname: string | null;
  scope: 'tracker' | 'item';
  expiresAt: Date;
  items: { item: TrackerItemView; tasks: TrackerTaskView[] }[];
}

/** What a parent sees: stages, deadlines and checklists. Never notes or anything else. */
export async function getSharedView(
  db: Db,
  token: string,
  lang: Lang,
  now: Date = new Date(),
): Promise<SharedView | null> {
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), gt(shareLinks.expiresAt, now)))
    .limit(1);
  if (!link) return null;
  const [profile] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, link.userId))
    .limit(1);
  const rows = await db
    .select()
    .from(trackerItems)
    .where(
      and(
        eq(trackerItems.userId, link.userId),
        link.itemId === null ? undefined : eq(trackerItems.id, link.itemId),
      ),
    )
    .limit(MAX_ITEMS);
  const views = (await buildViews(db, lang, rows)).sort(byDeadline);
  const items = await Promise.all(
    views.map(async (item) => ({
      item: { ...item, notes: null },
      tasks: await listTasks(db, item.id),
    })),
  );
  return {
    lang: link.lang,
    nickname: profile?.displayName ?? null,
    scope: link.scope,
    expiresAt: link.expiresAt,
    items,
  };
}

// ---------------------------------------------------------------------------
// Reminders (used by lib/reminders.ts)
// ---------------------------------------------------------------------------

/** Views for given item ids (any user): the reminder run builds its emails from these. */
export async function viewsByIds(db: Db, lang: Lang, itemIds: number[]) {
  if (itemIds.length === 0) return [];
  const rows = await db.select().from(trackerItems).where(inArray(trackerItems.id, itemIds));
  return buildViews(db, lang, rows);
}

/** Last day a reminder window still looks for, from a run day. */
export const reminderHorizon = (today: string) => addDays(today, 30);
