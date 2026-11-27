/**
 * Account data: profile, quick-question answers, saved items, and deleting an
 * account with everything in it. Plain functions over the Db so they are unit
 * tested against the local D1.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as z from 'zod';
import { LANGS, type Lang } from '../i18n/config.ts';
import { findReportTarget, type ReportTarget } from './db/catalog.ts';
import type { Db } from './db/client.ts';
import { profiles, savedItems, user, verification, type QuizAnswers } from './db/schema.ts';
import { REMINDER_CHANNELS, SAVED_ITEM_TYPES, type SavedItemType } from './db/values.ts';

export type Profile = typeof profiles.$inferSelect;

/** The profile row, created on first use with the language the student is reading in. */
export async function ensureProfile(db: Db, userId: string, lang: Lang): Promise<Profile> {
  await db.insert(profiles).values({ userId, preferredLang: lang }).onConflictDoNothing();
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!row) throw new Error('profile missing after insert');
  return row;
}

export { THEME_COOKIE, THEMES, type Theme } from './theme.ts';

export const profileSchema = z.object({
  preferredLang: z.enum(LANGS).optional(),
  reminderChannel: z.enum(REMINDER_CHANNELS).optional(),
  displayName: z
    .string()
    .trim()
    .max(40)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional(),
});
export type ProfilePatch = z.infer<typeof profileSchema>;

export async function updateProfile(db: Db, userId: string, patch: ProfilePatch): Promise<void> {
  const values = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as ProfilePatch;
  if (Object.keys(values).length === 0) return;
  await db.update(profiles).set(values).where(eq(profiles.userId, userId));
}

// ---------------------------------------------------------------------------
// Quick questions
// ---------------------------------------------------------------------------

export const ENGLISH_TESTS = ['IELTS', 'TOEFL', 'Duolingo', 'none'] as const;

export const quizSchema = z.object({
  countries: z
    .array(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/),
    )
    .max(12)
    .default([]),
  field: z.string().trim().max(40).nullable().default(null),
  budgetPerYearUsd: z.number().int().min(0).max(1_000_000).nullable().default(null),
  englishTest: z
    .object({
      name: z.enum(ENGLISH_TESTS),
      score: z.string().trim().max(10),
    })
    .nullable()
    .default(null),
}) satisfies z.ZodType<QuizAnswers, unknown>;

export async function setQuiz(db: Db, userId: string, quiz: QuizAnswers): Promise<void> {
  await db.update(profiles).set({ quiz }).where(eq(profiles.userId, userId));
}

// ---------------------------------------------------------------------------
// Saved items
// ---------------------------------------------------------------------------

export const savedItemSchema = z.object({
  type: z.enum(SAVED_ITEM_TYPES),
  id: z.coerce.number().int().positive().max(2_147_483_647),
});
export type SavedItemRef = z.infer<typeof savedItemSchema>;

/** Only published records can be saved. */
export async function itemExists(db: Db, item: SavedItemRef): Promise<boolean> {
  return (await findReportTarget(db, 'en', item.type, item.id)) !== null;
}

export async function setSaved(
  db: Db,
  userId: string,
  item: SavedItemRef,
  saved: boolean,
): Promise<'ok' | 'notFound'> {
  if (!saved) {
    await db
      .delete(savedItems)
      .where(
        and(
          eq(savedItems.userId, userId),
          eq(savedItems.itemType, item.type),
          eq(savedItems.itemId, item.id),
        ),
      );
    return 'ok';
  }
  if (!(await itemExists(db, item))) return 'notFound';
  await db
    .insert(savedItems)
    .values({ userId, itemType: item.type, itemId: item.id })
    .onConflictDoNothing();
  return 'ok';
}

/** One saved row, by its primary key. */
export function savedCheckQuery(db: Db, userId: string, item: SavedItemRef) {
  return db
    .select({ n: sql<number>`1` })
    .from(savedItems)
    .where(
      and(
        eq(savedItems.userId, userId),
        eq(savedItems.itemType, item.type),
        eq(savedItems.itemId, item.id),
      ),
    )
    .limit(1);
}

export async function isSaved(db: Db, userId: string, item: SavedItemRef): Promise<boolean> {
  const [row] = await savedCheckQuery(db, userId, item);
  return row !== undefined;
}

/** A saved row, with the record it points to (null once it is unpublished). */
export interface SavedEntry {
  type: SavedItemType;
  id: number;
  savedAt: Date;
  target: ReportTarget | null;
}

/** A student saves dozens of things, not thousands; past this the list stops. */
export const MAX_SAVED = 200;

/** A user's saved rows, newest first (the primary key starts with user_id). */
export function savedListQuery(db: Db, userId: string) {
  return db
    .select()
    .from(savedItems)
    .where(eq(savedItems.userId, userId))
    .orderBy(desc(savedItems.createdAt))
    .limit(MAX_SAVED);
}

export async function listSaved(db: Db, userId: string, lang: Lang): Promise<SavedEntry[]> {
  const rows = await savedListQuery(db, userId);
  const targets = await Promise.all(
    rows.map((r) => findReportTarget(db, lang, r.itemType, r.itemId)),
  );
  return rows.map((r, i) => ({
    type: r.itemType,
    id: r.itemId,
    savedAt: r.createdAt,
    target: targets[i] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Pending action: what the student tried before signing in
// ---------------------------------------------------------------------------

/** `save:program:101`. M4 adds `track:…`. */
export interface PendingAction {
  kind: 'save';
  item: SavedItemRef;
}

export function parsePendingAction(value: unknown): PendingAction | null {
  if (typeof value !== 'string') return null;
  const [kind, type, id] = value.split(':');
  if (kind !== 'save') return null;
  const item = savedItemSchema.safeParse({ type, id });
  return item.success ? { kind: 'save', item: item.data } : null;
}

export function serializePendingAction(action: PendingAction): string {
  return `${action.kind}:${action.item.type}:${action.item.id}`;
}

export async function runPendingAction(
  db: Db,
  userId: string,
  action: PendingAction,
): Promise<void> {
  await setSaved(db, userId, action.item, true);
}

// ---------------------------------------------------------------------------
// Deleting an account
// ---------------------------------------------------------------------------

/**
 * Deletes the user. Every table that holds a user's data references `user.id`
 * with ON DELETE CASCADE (sessions, sign-in methods, profile, saved items,
 * tracker, share links, posts, votes, reports, badges), so one statement
 * removes it all. Admin audit entries keep the change but lose the name
 * (ON DELETE SET NULL).
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!row) return;
  const email = row.email.toLowerCase();
  await db.batch([
    db.delete(user).where(eq(user.id, userId)),
    // Unused sign-in codes are keyed by address (`sign-in-otp-<email>`), not by user.
    db.delete(verification).where(
      inArray(
        verification.identifier,
        OTP_TYPES.map((type) => `${type}-otp-${email}`),
      ),
    ),
  ]);
}

const OTP_TYPES = ['sign-in', 'change-email', 'email-verification', 'forget-password'];
