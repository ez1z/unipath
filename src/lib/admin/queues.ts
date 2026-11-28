/**
 * The admin queues (SPEC): mistake reports, reported posts, and "Studies
 * here" badge requests. Every decision is written to the audit log in the
 * same batch.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Lang, Translate } from '../../i18n/index.ts';
import type { Db } from '../db/client.ts';
import {
  mistakeReports,
  pathwayColleges,
  profiles,
  programs,
  replies,
  reports,
  scholarships,
  threads,
  universities,
  user,
  userBadges,
} from '../db/schema.ts';
import type { EntityType } from '../db/values.ts';
import { authorName } from '../discussions.ts';
import { threadPath } from '../discussions-view.ts';
import { auditInsert } from './audit.ts';
import { runBatch } from './record-type.ts';

// ---------------------------------------------------------------------------
// Mistake reports
// ---------------------------------------------------------------------------

export interface MistakeView {
  id: number;
  entityType: EntityType;
  entityId: string;
  message: string;
  createdAt: Date;
  /** The record's English name, if it still exists. */
  name: string | null;
  adminPath: string | null;
  publicPath: string | null;
}

const ADMIN_TYPE_OF: Partial<Record<EntityType, string>> = {
  university: 'universities',
  college: 'colleges',
  program: 'programs',
  scholarship: 'scholarships',
};

async function namesOf(db: Db, type: EntityType, ids: number[]) {
  if (ids.length === 0)
    return new Map<number, { name: string; slug: string; published: boolean }>();
  const table =
    type === 'university'
      ? universities
      : type === 'college'
        ? pathwayColleges
        : type === 'program'
          ? programs
          : type === 'scholarship'
            ? scholarships
            : null;
  if (!table) return new Map();
  const rows = await db
    .select({ id: table.id, name: table.name, slug: table.slug, published: table.published })
    .from(table)
    .where(inArray(table.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

const PUBLIC_PREFIX: Partial<Record<EntityType, string>> = {
  university: 'universities',
  college: 'colleges',
  program: 'programs',
  scholarship: 'scholarships',
};

export async function openMistakes(db: Db, lang: Lang): Promise<MistakeView[]> {
  const rows = await db
    .select()
    .from(mistakeReports)
    .where(eq(mistakeReports.status, 'open'))
    .orderBy(asc(mistakeReports.createdAt))
    .limit(200);
  const byType = new Map<EntityType, number[]>();
  for (const r of rows) {
    const n = Number(r.entityId);
    if (Number.isInteger(n)) byType.set(r.entityType, [...(byType.get(r.entityType) ?? []), n]);
  }
  const names = new Map<string, { name: string; slug: string; published: boolean }>();
  for (const [type, ids] of byType) {
    for (const [id, row] of await namesOf(db, type, ids)) names.set(`${type}:${id}`, row);
  }
  return rows.map((r) => {
    const found = names.get(`${r.entityType}:${r.entityId}`);
    const adminType = ADMIN_TYPE_OF[r.entityType];
    const prefix = PUBLIC_PREFIX[r.entityType];
    return {
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      message: r.message,
      createdAt: r.createdAt,
      name: found?.name ?? null,
      adminPath: found && adminType ? `/admin/${adminType}/${r.entityId}` : null,
      publicPath: found?.published && prefix ? `/${lang}/${prefix}/${found.slug}` : null,
    };
  });
}

export async function closeMistake(
  db: Db,
  adminId: string,
  id: number,
  status: 'resolved' | 'dismissed',
): Promise<boolean> {
  const [row] = await db
    .select({ id: mistakeReports.id })
    .from(mistakeReports)
    .where(eq(mistakeReports.id, id));
  if (!row) return false;
  await runBatch(db, [
    db.update(mistakeReports).set({ status }).where(eq(mistakeReports.id, id)),
    auditInsert(db, {
      adminId,
      action: status === 'resolved' ? 'resolve' : 'dismiss',
      entityType: 'mistake_report',
      entityId: id,
    }),
  ]);
  return true;
}

// ---------------------------------------------------------------------------
// Reported posts
// ---------------------------------------------------------------------------

export interface ReportedPost {
  targetType: 'thread' | 'reply';
  targetId: number;
  hidden: boolean;
  body: string;
  /** The thread's title (for a reply, the thread it is in). */
  threadTitle: string;
  threadPath: string;
  author: string;
  reports: number;
  reasons: string[];
}

/** Posts with reports no admin has reviewed, and every hidden post. Oldest first. */
export async function reportedPosts(db: Db, lang: Lang, t: Translate): Promise<ReportedPost[]> {
  const pending = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      n: sql<number>`count(*)`,
      reasons: sql<string>`group_concat(${reports.reason}, char(31))`,
      first: sql<number>`min(${reports.createdAt})`,
    })
    .from(reports)
    .where(eq(reports.reviewed, false))
    .groupBy(reports.targetType, reports.targetId)
    .orderBy(sql`min(${reports.createdAt})`)
    .limit(200);

  const threadIds = pending.filter((p) => p.targetType === 'thread').map((p) => p.targetId);
  const replyIds = pending.filter((p) => p.targetType === 'reply').map((p) => p.targetId);

  const [hiddenThreads, hiddenReplies] = await Promise.all([
    db.select({ id: threads.id }).from(threads).where(eq(threads.status, 'hidden')).limit(200),
    db.select({ id: replies.id }).from(replies).where(eq(replies.status, 'hidden')).limit(200),
  ]);
  const allThreads = [...new Set([...threadIds, ...hiddenThreads.map((r) => r.id)])];
  const allReplies = [...new Set([...replyIds, ...hiddenReplies.map((r) => r.id)])];

  const replyRows = allReplies.length
    ? await db
        .select({
          id: replies.id,
          body: replies.body,
          status: replies.status,
          threadId: replies.threadId,
          authorId: replies.authorId,
          nickname: profiles.displayName,
        })
        .from(replies)
        .leftJoin(profiles, eq(profiles.userId, replies.authorId))
        .where(inArray(replies.id, allReplies))
    : [];
  const threadRows = await db
    .select({
      id: threads.id,
      title: threads.title,
      body: threads.body,
      status: threads.status,
      topic: threads.topicSlug,
      authorId: threads.authorId,
      nickname: profiles.displayName,
    })
    .from(threads)
    .leftJoin(profiles, eq(profiles.userId, threads.authorId))
    .where(inArray(threads.id, [...new Set([...allThreads, ...replyRows.map((r) => r.threadId)])]));
  const threadById = new Map(threadRows.map((r) => [r.id, r]));
  const counts = new Map(pending.map((p) => [`${p.targetType}:${p.targetId}`, p]));

  const out: ReportedPost[] = [];
  for (const id of allThreads) {
    const th = threadById.get(id);
    if (!th) continue;
    const c = counts.get(`thread:${id}`);
    out.push({
      targetType: 'thread',
      targetId: id,
      hidden: th.status === 'hidden',
      body: th.body,
      threadTitle: th.title,
      threadPath: threadPath(lang, th.topic, th.id),
      author: authorName(t, { id: th.authorId, nickname: th.nickname }),
      reports: Number(c?.n ?? 0),
      reasons: c?.reasons ? c.reasons.split('\u001f') : [],
    });
  }
  for (const r of replyRows) {
    const th = threadById.get(r.threadId);
    if (!th) continue;
    const c = counts.get(`reply:${r.id}`);
    out.push({
      targetType: 'reply',
      targetId: r.id,
      hidden: r.status === 'hidden',
      body: r.body,
      threadTitle: th.title,
      threadPath: threadPath(lang, th.topic, th.id),
      author: authorName(t, { id: r.authorId, nickname: r.nickname }),
      reports: Number(c?.n ?? 0),
      reasons: c?.reasons ? c.reasons.split('\u001f') : [],
    });
  }
  return out;
}

export type PostDecision = 'restore' | 'hide' | 'delete';

export async function decidePost(
  db: Db,
  adminId: string,
  targetType: 'thread' | 'reply',
  targetId: number,
  decision: PostDecision,
): Promise<boolean> {
  const table = targetType === 'thread' ? threads : replies;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, targetId));
  if (!row) return false;
  const ofTarget = and(eq(reports.targetType, targetType), eq(reports.targetId, targetId));
  const audit = auditInsert(db, {
    adminId,
    action: decision === 'restore' ? 'restore' : decision === 'hide' ? 'hide' : 'delete',
    entityType: targetType,
    entityId: targetId,
  });

  if (decision === 'restore') {
    await runBatch(db, [
      db.update(table).set({ status: 'open' }).where(eq(table.id, targetId)),
      db.update(reports).set({ reviewed: true }).where(ofTarget),
      audit,
    ]);
  } else if (decision === 'hide') {
    await runBatch(db, [
      db.update(table).set({ status: 'hidden' }).where(eq(table.id, targetId)),
      db.update(reports).set({ reviewed: true }).where(ofTarget),
      ...(targetType === 'reply'
        ? [
            db
              .update(threads)
              .set({ helpedReplyId: null })
              .where(eq(threads.helpedReplyId, targetId)),
          ]
        : []),
      audit,
    ]);
  } else {
    const replyIds =
      targetType === 'thread'
        ? (
            await db.select({ id: replies.id }).from(replies).where(eq(replies.threadId, targetId))
          ).map((r) => r.id)
        : [];
    await runBatch(db, [
      db.delete(reports).where(ofTarget),
      ...(replyIds.length
        ? [
            db
              .delete(reports)
              .where(and(eq(reports.targetType, 'reply'), inArray(reports.targetId, replyIds))),
          ]
        : []),
      ...(targetType === 'reply'
        ? [
            db
              .update(threads)
              .set({ helpedReplyId: null })
              .where(eq(threads.helpedReplyId, targetId)),
            db
              .update(threads)
              .set({ replyCount: sql`max(${threads.replyCount} - 1, 0)` })
              .where(
                eq(
                  threads.id,
                  sql`(select ${replies.threadId} from ${replies} where ${replies.id} = ${targetId})`,
                ),
              ),
          ]
        : []),
      db.delete(table).where(eq(table.id, targetId)),
      audit,
    ]);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeView {
  id: number;
  type: 'studies_here' | 'team';
  userId: string;
  who: string;
  email: string;
  university: string | null;
  note: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
}

async function badgeRows(db: Db, t: Translate, pending: boolean): Promise<BadgeView[]> {
  const rows = await db
    .select({
      id: userBadges.id,
      type: userBadges.type,
      userId: userBadges.userId,
      email: user.email,
      nickname: profiles.displayName,
      university: universities.name,
      note: userBadges.note,
      createdAt: userBadges.createdAt,
      verifiedAt: userBadges.verifiedAt,
    })
    .from(userBadges)
    .innerJoin(user, eq(user.id, userBadges.userId))
    .leftJoin(profiles, eq(profiles.userId, userBadges.userId))
    .leftJoin(universities, eq(universities.id, userBadges.universityId))
    .where(pending ? isNull(userBadges.verifiedAt) : isNotNull(userBadges.verifiedAt))
    .orderBy(pending ? asc(userBadges.createdAt) : desc(userBadges.verifiedAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    userId: r.userId,
    who: authorName(t, { id: r.userId, nickname: r.nickname }),
    email: r.email,
    university: r.university,
    note: r.note,
    createdAt: r.createdAt,
    verifiedAt: r.verifiedAt,
  }));
}

export const pendingBadges = (db: Db, t: Translate) => badgeRows(db, t, true);
export const verifiedBadges = (db: Db, t: Translate) => badgeRows(db, t, false);

export async function decideBadge(
  db: Db,
  adminId: string,
  id: number,
  decision: 'approve' | 'reject' | 'revoke',
): Promise<boolean> {
  const [row] = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(eq(userBadges.id, id));
  if (!row) return false;
  const audit = auditInsert(db, {
    adminId,
    action: decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'revoke',
    entityType: 'badge',
    entityId: id,
  });
  await runBatch(db, [
    decision === 'approve'
      ? db
          .update(userBadges)
          .set({ verifiedBy: adminId, verifiedAt: new Date() })
          .where(and(eq(userBadges.id, id), isNull(userBadges.verifiedAt)))
      : db.delete(userBadges).where(eq(userBadges.id, id)),
    audit,
  ]);
  return true;
}

/** "Clavis team" badge for the account with this email. */
export async function grantTeamBadge(
  db: Db,
  adminId: string,
  email: string,
): Promise<'ok' | 'noUser' | 'already'> {
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);
  if (!target) return 'noUser';
  const [existing] = await db
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(and(eq(userBadges.userId, target.id), eq(userBadges.type, 'team')))
    .limit(1);
  if (existing) return 'already';
  await runBatch(db, [
    db.insert(userBadges).values({
      userId: target.id,
      type: 'team',
      verifiedBy: adminId,
      verifiedAt: new Date(),
    }),
    auditInsert(db, {
      adminId,
      action: 'grant',
      entityType: 'badge',
      entityId: `team:${target.id}`,
    }),
  ]);
  return 'ok';
}

/** Counts for the overview page. */
export async function queueCounts(db: Db) {
  const [mistakes, posts, badges] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(mistakeReports)
      .where(eq(mistakeReports.status, 'open')),
    db
      .select({
        n: sql<number>`count(distinct ${reports.targetType} || ':' || ${reports.targetId})`,
      })
      .from(reports)
      .where(eq(reports.reviewed, false)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(userBadges)
      .where(isNull(userBadges.verifiedAt)),
  ]);
  return {
    mistakes: Number(mistakes[0]?.n ?? 0),
    posts: Number(posts[0]?.n ?? 0),
    badges: Number(badges[0]?.n ?? 0),
  };
}
