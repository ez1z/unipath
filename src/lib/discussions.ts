/**
 * Discussions: six topic boards, threads and replies, "Helped me", helpful
 * votes, similar questions (FTS5), tags to a university or program, reports
 * that hide a post after three, daily limits, and "Studies here" badge requests.
 * Plain functions over the Db, unit tested against the local D1.
 *
 * Posts are plain text. They are stored as written and escaped when shown
 * (components/PostBody.astro); only http(s) links become links. The rules box
 * beside every form asks for no contacts or ads; reports catch the rest.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import * as z from 'zod';
import { LANGS, type Lang } from '../i18n/config.ts';
import type { Translate } from '../i18n/index.ts';
import type { Db } from './db/client.ts';
import { loadTexts, mainVisible, type LocalText } from './db/queries.ts';
import {
  pathwayColleges,
  profiles,
  programs,
  replies,
  replyVotes,
  reports,
  threads,
  topics,
  universities,
  userBadges,
} from './db/schema.ts';
import { TOPIC_SLUGS, type PostStatus } from './db/values.ts';

// ---------------------------------------------------------------------------
// Limits and validation
// ---------------------------------------------------------------------------

export const TITLE_MIN = 10;
export const TITLE_MAX = 140;
export const BODY_MAX = 5000;
export const REPLY_MAX = 3000;
/** SPEC: 5 threads and 30 replies per user per day. */
export const DAILY_THREADS = 5;
export const DAILY_REPLIES = 30;
export const REPORTS_TO_HIDE = 3;
export const THREADS_PAGE = 20;
export const SIMILAR_LIMIT = 5;
export const MAX_BADGE_REQUESTS = 3;
export const BADGE_NOTE_MAX = 300;
const DAY_MS = 86_400_000;

export const REPORT_REASONS = ['spam', 'contacts', 'rude', 'wrong', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const topicSchema = z.enum(TOPIC_SLUGS);
export type TopicSlug = z.infer<typeof topicSchema>;

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const optionalId = z
  .union([z.literal('').transform(() => null), idSchema, z.null()])
  .optional()
  .transform((v) => v ?? null);

/** Line breaks kept, other control characters dropped, outer space trimmed. */
function cleanText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

const postText = (min: number, max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(cleanText)
    .pipe(z.string().min(min).max(max));

export const threadInputSchema = z.object({
  topic: topicSchema,
  title: z
    .string()
    .max(TITLE_MAX * 2)
    .transform((s) => cleanText(s).replace(/\s+/g, ' '))
    .pipe(z.string().min(TITLE_MIN).max(TITLE_MAX)),
  body: postText(1, BODY_MAX),
  postLang: z.enum(LANGS),
  universityId: optionalId,
  programId: optionalId,
});
export type ThreadInput = z.infer<typeof threadInputSchema>;

export const replyBodySchema = postText(2, REPLY_MAX);

/** A stable made-up name number per user: "Student 4821". Not reversible to the id. */
export function autoNameNumber(userId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1000 + ((hash >>> 0) % 9000);
}

export function authorName(t: Translate, author: { id: string; nickname: string | null }): string {
  // As text: a made-up name, not a quantity, so no "1,358" grouping.
  return author.nickname ?? t('discussions.student', { n: String(autoNameNumber(author.id)) });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface PostAuthor {
  id: string;
  nickname: string | null;
  team: boolean;
  /** Universities where an admin confirmed the author studies. */
  studiesAt: { id: number; name: LocalText }[];
}

export interface TopicView {
  slug: TopicSlug;
  name: LocalText;
}

export interface TagView {
  type: 'university' | 'program';
  id: number;
  name: LocalText;
  /** Public path without the language. */
  path: string;
}

export interface ThreadSummary {
  id: number;
  topic: TopicSlug;
  title: string;
  lang: Lang;
  answered: boolean;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  tag: TagView | null;
}

export interface ThreadView extends ThreadSummary {
  body: string;
  status: PostStatus;
  helpedReplyId: number | null;
  author: PostAuthor;
}

export interface ReplyView {
  id: number;
  body: string;
  status: PostStatus;
  helpfulCount: number;
  createdAt: Date;
  author: PostAuthor;
  /** The viewer's own state; false when signed out. */
  votedByViewer: boolean;
  reportedByViewer: boolean;
}

export async function listTopics(db: Db, lang: Lang): Promise<TopicView[]> {
  const rows = await db.select().from(topics).orderBy(asc(topics.sort));
  const texts = await loadTexts(db, lang, { topic: rows.map((r) => r.slug) }, ['name']);
  return rows
    .filter((r): r is { slug: TopicSlug; sort: number } => topicSchema.safeParse(r.slug).success)
    .map((r) => ({ slug: r.slug, name: texts.name('topic', r.slug, r.slug) }));
}

/** Open questions per board (threads(status, …) then a group by topic). */
export async function topicCounts(db: Db): Promise<Map<string, number>> {
  const rows = await db
    .select({ topic: threads.topicSlug, n: sql<number>`count(*)` })
    .from(threads)
    .where(eq(threads.status, 'open'))
    .groupBy(threads.topicSlug);
  return new Map(rows.map((r) => [r.topic, Number(r.n)]));
}

const summaryColumns = {
  id: threads.id,
  topic: threads.topicSlug,
  title: threads.title,
  lang: threads.lang,
  helpedReplyId: threads.helpedReplyId,
  replyCount: threads.replyCount,
  lastActivityAt: threads.lastActivityAt,
  createdAt: threads.createdAt,
  universityId: threads.universityId,
  programId: threads.programId,
};

interface SummaryRow {
  id: number;
  topic: string;
  title: string;
  lang: Lang;
  helpedReplyId: number | null;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  universityId: number | null;
  programId: number | null;
}

/** Tags of some threads: names in the page language, only for published records. */
async function loadTags(
  db: Db,
  lang: Lang,
  rows: { universityId: number | null; programId: number | null }[],
): Promise<{ university: Map<number, TagView>; program: Map<number, TagView> }> {
  const uniIds = [...new Set(rows.flatMap((r) => (r.universityId ? [r.universityId] : [])))];
  const programIds = [...new Set(rows.flatMap((r) => (r.programId ? [r.programId] : [])))];
  const [unis, progs] = await Promise.all([
    uniIds.length
      ? db
          .select({ id: universities.id, slug: universities.slug, name: universities.name })
          .from(universities)
          .where(and(inArray(universities.id, uniIds), eq(universities.published, true)))
      : [],
    programIds.length
      ? db
          .select({ id: programs.id, slug: programs.slug, name: programs.name })
          .from(programs)
          .leftJoin(universities, eq(universities.id, programs.universityId))
          .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
          .where(and(inArray(programs.id, programIds), mainVisible))
      : [],
  ]);
  const texts = await loadTexts(
    db,
    lang,
    { university: unis.map((u) => u.id), program: progs.map((p) => p.id) },
    ['name'],
  );
  return {
    university: new Map(
      unis.map((u) => [
        u.id,
        {
          type: 'university',
          id: u.id,
          name: texts.name('university', u.id, u.name),
          path: `/universities/${u.slug}`,
        },
      ]),
    ),
    program: new Map(
      progs.map((p) => [
        p.id,
        {
          type: 'program',
          id: p.id,
          name: texts.name('program', p.id, p.name),
          path: `/programs/${p.slug}`,
        },
      ]),
    ),
  };
}

async function toSummaries(db: Db, lang: Lang, rows: SummaryRow[]): Promise<ThreadSummary[]> {
  const tags = await loadTags(db, lang, rows);
  return rows.flatMap((r) => {
    const topic = topicSchema.safeParse(r.topic);
    if (!topic.success) return [];
    return [
      {
        id: r.id,
        topic: topic.data,
        title: r.title,
        lang: r.lang,
        answered: r.helpedReplyId !== null,
        replyCount: r.replyCount,
        lastActivityAt: r.lastActivityAt,
        createdAt: r.createdAt,
        tag:
          (r.programId ? tags.program.get(r.programId) : undefined) ??
          (r.universityId ? tags.university.get(r.universityId) : undefined) ??
          null,
      },
    ];
  });
}

/** A board's open threads, most recent activity first (threads(topic_slug, last_activity_at)). */
export async function listThreads(
  db: Db,
  lang: Lang,
  topic: TopicSlug,
  page = 1,
): Promise<{ items: ThreadSummary[]; hasMore: boolean }> {
  const limit = THREADS_PAGE * page;
  const rows = await db
    .select(summaryColumns)
    .from(threads)
    .where(and(eq(threads.topicSlug, topic), eq(threads.status, 'open')))
    .orderBy(desc(threads.lastActivityAt), desc(threads.id))
    .limit(limit + 1);
  return { items: await toSummaries(db, lang, rows.slice(0, limit)), hasMore: rows.length > limit };
}

/** "New in Discussions": every board (threads(status, last_activity_at)). */
export async function latestThreads(db: Db, lang: Lang, limit = 5): Promise<ThreadSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(threads)
    .where(eq(threads.status, 'open'))
    .orderBy(desc(threads.lastActivityAt))
    .limit(limit);
  return toSummaries(db, lang, rows);
}

/** Threads tagged with a university (its Discussion tab) or a program. */
export async function threadsTagged(
  db: Db,
  lang: Lang,
  tag: { type: 'university' | 'program'; id: number },
  limit = 20,
): Promise<ThreadSummary[]> {
  const column = tag.type === 'university' ? threads.universityId : threads.programId;
  const rows = await db
    .select(summaryColumns)
    .from(threads)
    .where(and(eq(column, tag.id), eq(threads.status, 'open')))
    .orderBy(desc(threads.lastActivityAt))
    .limit(limit);
  return toSummaries(db, lang, rows);
}

/** Words of a title as an FTS5 OR query: any shared word counts, best matches first. */
export function toSimilarQuery(title: string): string | null {
  const words =
    title
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter((w) => w.length >= 3))].slice(0, 8).map((w) => `"${w}"*`);
  return terms.length === 0 ? null : terms.join(' OR ');
}

/** Up to five open threads with words like these, best first. */
export async function similarThreads(
  db: Db,
  lang: Lang,
  title: string,
  excludeId: number | null = null,
): Promise<ThreadSummary[]> {
  const query = toSimilarQuery(title);
  if (!query) return [];
  const rows = await db
    .select(summaryColumns)
    .from(sql`thread_search`)
    .innerJoin(threads, sql`${threads.id} = thread_search.rowid`)
    .where(
      and(
        sql`thread_search match ${query}`,
        eq(threads.status, 'open'),
        excludeId === null ? undefined : sql`${threads.id} <> ${excludeId}`,
      ),
    )
    .orderBy(sql`bm25(thread_search)`)
    .limit(SIMILAR_LIMIT);
  return toSummaries(db, lang, rows);
}

/** Nicknames and verified badges of some authors. */
async function loadAuthors(db: Db, lang: Lang, ids: string[]): Promise<Map<string, PostAuthor>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const [names, badges] = await Promise.all([
    db
      .select({ id: profiles.userId, nickname: profiles.displayName })
      .from(profiles)
      .where(inArray(profiles.userId, unique)),
    db
      .select({
        userId: userBadges.userId,
        type: userBadges.type,
        universityId: userBadges.universityId,
        universityName: universities.name,
      })
      .from(userBadges)
      .leftJoin(universities, eq(universities.id, userBadges.universityId))
      .where(and(inArray(userBadges.userId, unique), isNotNull(userBadges.verifiedAt))),
  ]);
  const texts = await loadTexts(
    db,
    lang,
    { university: badges.flatMap((b) => (b.universityId ? [b.universityId] : [])) },
    ['name'],
  );
  const nicknameOf = new Map(names.map((n) => [n.id, n.nickname]));
  const authors = new Map<string, PostAuthor>();
  for (const id of unique) {
    authors.set(id, { id, nickname: nicknameOf.get(id) ?? null, team: false, studiesAt: [] });
  }
  for (const badge of badges) {
    const author = authors.get(badge.userId);
    if (!author) continue;
    if (badge.type === 'team') author.team = true;
    else if (badge.universityId && badge.universityName) {
      author.studiesAt.push({
        id: badge.universityId,
        name: texts.name('university', badge.universityId, badge.universityName),
      });
    }
  }
  return authors;
}

export interface ThreadPage {
  thread: ThreadView;
  /** "Helped the asker" first, then by time. Hidden replies keep their place, without text. */
  replies: ReplyView[];
}

/** A thread and its replies, with the viewer's votes and reports when signed in. */
export async function getThread(
  db: Db,
  lang: Lang,
  id: number,
  viewerId: string | null = null,
): Promise<ThreadPage | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      body: threads.body,
      status: threads.status,
      authorId: threads.authorId,
    })
    .from(threads)
    .where(eq(threads.id, id))
    .limit(1);
  if (!row) return null;
  const replyRows = await db
    .select()
    .from(replies)
    .where(eq(replies.threadId, id))
    .orderBy(asc(replies.createdAt), asc(replies.id))
    .limit(500);
  const replyIds = replyRows.map((r) => r.id);
  const [authors, [summary], voted, reported] = await Promise.all([
    loadAuthors(db, lang, [row.authorId, ...replyRows.map((r) => r.authorId)]),
    toSummaries(db, lang, [row]),
    viewerId && replyIds.length
      ? db
          .select({ id: replyVotes.replyId })
          .from(replyVotes)
          .where(and(eq(replyVotes.userId, viewerId), inArray(replyVotes.replyId, replyIds)))
      : [],
    viewerId
      ? db
          .select({ type: reports.targetType, id: reports.targetId })
          .from(reports)
          .where(
            and(
              eq(reports.reporterId, viewerId),
              or(
                and(eq(reports.targetType, 'thread'), eq(reports.targetId, id)),
                replyIds.length
                  ? and(eq(reports.targetType, 'reply'), inArray(reports.targetId, replyIds))
                  : undefined,
              ),
            ),
          )
      : [],
  ]);
  if (!summary) return null;
  const votedIds = new Set(voted.map((v) => v.id));
  const reportedReplies = new Set(reported.filter((r) => r.type === 'reply').map((r) => r.id));
  const fallbackAuthor = (authorId: string): PostAuthor => ({
    id: authorId,
    nickname: null,
    team: false,
    studiesAt: [],
  });
  const replyViews = replyRows.map((r): ReplyView => ({
    id: r.id,
    body: r.body,
    status: r.status,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt,
    author: authors.get(r.authorId) ?? fallbackAuthor(r.authorId),
    votedByViewer: votedIds.has(r.id),
    reportedByViewer: reportedReplies.has(r.id),
  }));
  const helped = row.helpedReplyId;
  replyViews.sort((a, b) => Number(b.id === helped) - Number(a.id === helped));
  return {
    thread: {
      ...summary,
      body: row.body,
      status: row.status,
      helpedReplyId: helped,
      author: authors.get(row.authorId) ?? fallbackAuthor(row.authorId),
    },
    replies: replyViews,
  };
}

/** Whether the viewer reported the thread itself. */
export async function reportedThread(db: Db, viewerId: string, threadId: number) {
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, 'thread'),
        eq(reports.targetId, threadId),
        eq(reports.reporterId, viewerId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function threadAuthor(db: Db, threadId: number): Promise<string | null> {
  const [row] = await db
    .select({ authorId: threads.authorId })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  return row?.authorId ?? null;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type PostError = 'daily' | 'notFound' | 'closed' | 'tag';

/** Posts by this user in the last 24 hours (the *_author_idx indexes). */
async function postsToday(db: Db, kind: 'thread' | 'reply', userId: string, now: Date) {
  const since = new Date(now.getTime() - DAY_MS);
  const table = kind === 'thread' ? threads : replies;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(and(eq(table.authorId, userId), gte(table.createdAt, since)));
  return Number(row?.n ?? 0);
}

/** A tag must point at a published record; a program tag also tags its university. */
async function checkTags(
  db: Db,
  input: Pick<ThreadInput, 'universityId' | 'programId'>,
): Promise<{ universityId: number | null; programId: number | null } | null> {
  let { universityId } = input;
  const { programId } = input;
  if (programId !== null) {
    const [row] = await db
      .select({ universityId: programs.universityId })
      .from(programs)
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(and(eq(programs.id, programId), mainVisible))
      .limit(1);
    if (!row) return null;
    universityId = row.universityId ?? universityId;
  }
  if (universityId !== null) {
    const [row] = await db
      .select({ id: universities.id })
      .from(universities)
      .where(and(eq(universities.id, universityId), eq(universities.published, true)))
      .limit(1);
    if (!row) return null;
  }
  return { universityId, programId };
}

export async function createThread(
  db: Db,
  userId: string,
  input: ThreadInput,
  now: Date = new Date(),
): Promise<{ ok: true; id: number } | { ok: false; error: PostError }> {
  const tags = await checkTags(db, input);
  if (!tags) return { ok: false, error: 'tag' };
  if ((await postsToday(db, 'thread', userId, now)) >= DAILY_THREADS) {
    return { ok: false, error: 'daily' };
  }
  const [row] = await db
    .insert(threads)
    .values({
      topicSlug: input.topic,
      title: input.title,
      body: input.body,
      authorId: userId,
      lang: input.postLang,
      ...tags,
      lastActivityAt: now,
      createdAt: now,
    })
    .returning({ id: threads.id });
  if (!row) throw new Error('thread insert returned nothing');
  return { ok: true, id: row.id };
}

export async function createReply(
  db: Db,
  userId: string,
  threadId: number,
  body: string,
  now: Date = new Date(),
): Promise<{ ok: true; id: number } | { ok: false; error: PostError }> {
  const [thread] = await db
    .select({ status: threads.status })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  if (!thread) return { ok: false, error: 'notFound' };
  if (thread.status !== 'open') return { ok: false, error: 'closed' };
  if ((await postsToday(db, 'reply', userId, now)) >= DAILY_REPLIES) {
    return { ok: false, error: 'daily' };
  }
  const [row] = await db
    .insert(replies)
    .values({ threadId, authorId: userId, body, createdAt: now })
    .returning({ id: replies.id });
  if (!row) throw new Error('reply insert returned nothing');
  await db
    .update(threads)
    .set({ replyCount: sql`${threads.replyCount} + 1`, lastActivityAt: now })
    .where(eq(threads.id, threadId));
  return { ok: true, id: row.id };
}

/** The asker pins the reply that helped (or unpins with null). */
export async function setHelped(
  db: Db,
  userId: string,
  threadId: number,
  replyId: number | null,
): Promise<'ok' | 'notFound' | 'notAsker'> {
  const author = await threadAuthor(db, threadId);
  if (author === null) return 'notFound';
  if (author !== userId) return 'notAsker';
  if (replyId !== null) {
    const [reply] = await db
      .select({ id: replies.id })
      .from(replies)
      .where(
        and(eq(replies.id, replyId), eq(replies.threadId, threadId), eq(replies.status, 'open')),
      )
      .limit(1);
    if (!reply) return 'notFound';
  }
  await db
    .update(threads)
    .set({ helpedReplyId: replyId })
    .where(and(eq(threads.id, threadId), eq(threads.authorId, userId)));
  return 'ok';
}

/** One helpful vote per user per reply; not on one's own reply. Returns the new count. */
export async function voteHelpful(
  db: Db,
  userId: string,
  replyId: number,
  on: boolean,
): Promise<
  { ok: true; count: number; threadId: number } | { ok: false; error: 'notFound' | 'own' }
> {
  const [reply] = await db
    .select({ authorId: replies.authorId, threadId: replies.threadId, status: replies.status })
    .from(replies)
    .where(eq(replies.id, replyId))
    .limit(1);
  if (!reply || reply.status !== 'open') return { ok: false, error: 'notFound' };
  if (reply.authorId === userId) return { ok: false, error: 'own' };
  if (on) {
    await db.insert(replyVotes).values({ userId, replyId }).onConflictDoNothing();
  } else {
    await db
      .delete(replyVotes)
      .where(and(eq(replyVotes.userId, userId), eq(replyVotes.replyId, replyId)));
  }
  // Recount rather than +1/−1, so a double click can't drift the number.
  const [count] = await db
    .select({ n: sql<number>`count(*)` })
    .from(replyVotes)
    .where(eq(replyVotes.replyId, replyId));
  const n = Number(count?.n ?? 0);
  await db.update(replies).set({ helpfulCount: n }).where(eq(replies.id, replyId));
  return { ok: true, count: n, threadId: reply.threadId };
}

export const reportSchema = z.object({
  targetType: z.enum(['thread', 'reply']),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS),
});
export type ReportInput = z.infer<typeof reportSchema>;

/**
 * One report per user per post. At three, the post is hidden until an admin
 * reviews it (M7). Returns the thread, to go back to.
 */
export async function reportPost(
  db: Db,
  userId: string,
  input: ReportInput,
): Promise<
  { ok: true; threadId: number; hidden: boolean } | { ok: false; error: 'notFound' | 'own' }
> {
  const target =
    input.targetType === 'thread'
      ? (
          await db
            .select({ authorId: threads.authorId, threadId: threads.id })
            .from(threads)
            .where(eq(threads.id, input.targetId))
            .limit(1)
        )[0]
      : (
          await db
            .select({ authorId: replies.authorId, threadId: replies.threadId })
            .from(replies)
            .where(eq(replies.id, input.targetId))
            .limit(1)
        )[0];
  if (!target) return { ok: false, error: 'notFound' };
  if (target.authorId === userId) return { ok: false, error: 'own' };
  await db
    .insert(reports)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId: userId,
      reason: input.reason,
    })
    .onConflictDoNothing();
  const [count] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reports)
    .where(and(eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId)));
  const hidden = Number(count?.n ?? 0) >= REPORTS_TO_HIDE;
  if (hidden) {
    if (input.targetType === 'thread') {
      await db.update(threads).set({ status: 'hidden' }).where(eq(threads.id, input.targetId));
    } else {
      await db.update(replies).set({ status: 'hidden' }).where(eq(replies.id, input.targetId));
      // A hidden reply can't stay pinned as "Helped the asker".
      await db
        .update(threads)
        .set({ helpedReplyId: null })
        .where(and(eq(threads.id, target.threadId), eq(threads.helpedReplyId, input.targetId)));
    }
  }
  return { ok: true, threadId: target.threadId, hidden };
}

// ---------------------------------------------------------------------------
// "Studies here" badge requests
// ---------------------------------------------------------------------------

export const badgeRequestSchema = z.object({
  universityId: idSchema,
  note: z
    .string()
    .max(BADGE_NOTE_MAX * 2)
    .transform(cleanText)
    .pipe(z.string().min(5).max(BADGE_NOTE_MAX)),
});

export interface MyBadge {
  id: number;
  type: 'studies_here' | 'team';
  university: LocalText | null;
  verified: boolean;
}

export async function listMyBadges(db: Db, userId: string, lang: Lang): Promise<MyBadge[]> {
  const rows = await db
    .select({
      id: userBadges.id,
      type: userBadges.type,
      universityId: userBadges.universityId,
      universityName: universities.name,
      verifiedAt: userBadges.verifiedAt,
    })
    .from(userBadges)
    .leftJoin(universities, eq(universities.id, userBadges.universityId))
    .where(eq(userBadges.userId, userId));
  const texts = await loadTexts(
    db,
    lang,
    { university: rows.flatMap((r) => (r.universityId ? [r.universityId] : [])) },
    ['name'],
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    university:
      r.universityId && r.universityName
        ? texts.name('university', r.universityId, r.universityName)
        : null,
    verified: r.verifiedAt !== null,
  }));
}

export async function requestBadge(
  db: Db,
  userId: string,
  input: z.infer<typeof badgeRequestSchema>,
): Promise<'ok' | 'exists' | 'limit' | 'notFound'> {
  const [uni] = await db
    .select({ id: universities.id })
    .from(universities)
    .where(and(eq(universities.id, input.universityId), eq(universities.published, true)))
    .limit(1);
  if (!uni) return 'notFound';
  const mine = await db
    .select({ universityId: userBadges.universityId, verifiedAt: userBadges.verifiedAt })
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.type, 'studies_here')));
  if (mine.some((b) => b.universityId === input.universityId)) return 'exists';
  if (mine.filter((b) => b.verifiedAt === null).length >= MAX_BADGE_REQUESTS) return 'limit';
  await db.insert(userBadges).values({
    userId,
    type: 'studies_here',
    universityId: input.universityId,
    note: input.note,
  });
  return 'ok';
}

/** Withdraws a request that isn't approved yet. */
export async function withdrawBadgeRequest(db: Db, userId: string, id: number): Promise<boolean> {
  const rows = await db
    .delete(userBadges)
    .where(and(eq(userBadges.id, id), eq(userBadges.userId, userId), isNull(userBadges.verifiedAt)))
    .returning({ id: userBadges.id });
  return rows.length > 0;
}

/** Published universities for the request form, by English name. */
export async function universityChoices(db: Db, lang: Lang) {
  const rows = await db
    .select({ id: universities.id, name: universities.name })
    .from(universities)
    .where(eq(universities.published, true))
    .orderBy(asc(universities.name))
    .limit(500);
  const texts = await loadTexts(db, lang, { university: rows.map((r) => r.id) }, ['name']);
  return rows.map((r) => ({ id: r.id, name: texts.name('university', r.id, r.name).text }));
}
