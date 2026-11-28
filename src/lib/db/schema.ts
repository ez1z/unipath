/**
 * Drizzle schema for D1. Every table in SPEC.md "Data model" is here.
 * Migrations are generated from this file: `pnpm db:generate`.
 *
 * Conventions
 * - Dates without a time (last_checked, deadlines) are ISO `YYYY-MM-DD` text, so they sort and index.
 * - Moments (created_at, expires_at) are integer milliseconds (`timestamp_ms`).
 * - Enum-like columns are text with a CHECK built from the lists in values.ts.
 * - Every public record has last_checked, source_url and published; only published rows are shown.
 * - User data cascades from `user`, so deleting an account removes all its rows.
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import {
  BADGE_TYPES,
  COVERAGES,
  ENTITY_TYPES,
  FIELDS,
  MINISTRY_STATUSES,
  MISTAKE_STATUSES,
  POST_STATUSES,
  PROGRAM_LEVELS,
  PROVIDER_TYPES,
  REMINDER_CHANNELS,
  REMINDER_DAYS,
  REPORT_TARGETS,
  SAVED_ITEM_TYPES,
  SHARE_SCOPES,
  TRACKER_STAGES,
  TRI_STATES,
  UNIVERSITY_TYPES,
  USER_ROLES,
  type Cover,
  type DocumentCode,
} from './values.ts';

/** `column IN ('a', 'b')` for a CHECK constraint. Values come from values.ts, never from input. */
function oneOf(column: AnySQLiteColumn, values: readonly (string | number)[]): SQL {
  const list = values.map((v) => (typeof v === 'number' ? String(v) : `'${v}'`)).join(', ');
  return sql`${column} in (${sql.raw(list)})`;
}

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** last_checked, source_url, published: carried by every public record. */
const publicRecord = () => ({
  lastChecked: text('last_checked').notNull(),
  sourceUrl: text('source_url'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
});

/** A record may only be published with a source_url. */
const publishNeedsSource = (
  table: string,
  t: { published: AnySQLiteColumn; sourceUrl: AnySQLiteColumn },
) => check(`${table}_published_source`, sql`${t.published} = 0 or ${t.sourceUrl} is not null`);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const countries = sqliteTable(
  'countries',
  {
    /** ISO 3166-1 alpha-2, upper case. Names come from `translations`. */
    code: text('code').primaryKey(),
    /** Lower is more popular; null = not in the popular list. */
    popularRank: integer('popular_rank'),
  },
  // Covers the Home tiles and the country filter list, so neither reads the table.
  (t) => [index('countries_popular_idx').on(t.popularRank, t.code)],
);

export const universities = sqliteTable(
  'universities',
  {
    id: integer('id').primaryKey(),
    slug: text('slug').notNull(),
    /** English name; other languages come from `translations`. */
    name: text('name').notNull(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    city: text('city').notNull(),
    type: text('type', { enum: UNIVERSITY_TYPES }),
    website: text('website'),
    /** R2 keys (`logos/…webp`, 128 px; `photos/…webp`, up to 1200 px), uploaded in /admin. */
    logoKey: text('logo_key'),
    photoKey: text('photo_key'),
    ministryStatus: text('ministry_status', { enum: MINISTRY_STATUSES })
      .notNull()
      .default('unchecked'),
    /** Which ranking and position qualify it, e.g. "QS World University Rankings 2027: 450". */
    ministryBasis: text('ministry_basis'),
    rankingQs: integer('ranking_qs'),
    rankingThe: integer('ranking_the'),
    rankingArwu: integer('ranking_arwu'),
    rankingMoscow: integer('ranking_moscow'),
    ...publicRecord(),
  },
  (t) => [
    uniqueIndex('universities_slug_unique').on(t.slug),
    index('universities_country_ministry_idx').on(t.countryCode, t.ministryStatus),
    index('universities_published_ministry_idx').on(t.published, t.ministryStatus),
    check('universities_ministry_status', oneOf(t.ministryStatus, MINISTRY_STATUSES)),
    check('universities_type', sql`${t.type} is null or ${oneOf(t.type, UNIVERSITY_TYPES)}`),
    publishNeedsSource('universities', t),
  ],
);

export const pathwayColleges = sqliteTable(
  'pathway_colleges',
  {
    id: integer('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    city: text('city').notNull(),
    website: text('website'),
    ...publicRecord(),
  },
  (t) => [
    uniqueIndex('pathway_colleges_slug_unique').on(t.slug),
    index('pathway_colleges_country_idx').on(t.countryCode),
    publishNeedsSource('pathway_colleges', t),
  ],
);

/** `programs.requirements`. Tracker tasks are pre-filled from it. */
export interface ProgramRequirements {
  /** Minimum IELTS overall band; null = no IELTS requirement or not confirmed. */
  ieltsMin: number | null;
  /** Other tests, e.g. { name: 'SAT', min: '1200' }. */
  otherTests: { name: string; min: string | null }[];
  documents: DocumentCode[];
}

export const programs = sqliteTable(
  'programs',
  {
    id: integer('id').primaryKey(),
    slug: text('slug').notNull(),
    providerType: text('provider_type', { enum: PROVIDER_TYPES }).notNull(),
    universityId: integer('university_id').references(() => universities.id),
    collegeId: integer('college_id').references(() => pathwayColleges.id),
    level: text('level', { enum: PROGRAM_LEVELS }).notNull(),
    name: text('name').notNull(),
    /** Field of study; null for language years. */
    field: text('field', { enum: FIELDS }),
    /** ISO 639-1 code of the teaching language, e.g. 'en'. */
    languageOfStudy: text('language_of_study').notNull(),
    durationYears: real('duration_years').notNull(),
    /** Null = "Cost not confirmed". Never an estimate. */
    tuitionPerYearUsd: integer('tuition_per_year_usd'),
    /** Start months, 1–12, e.g. [9, 2]. */
    intakes: text('intakes', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),
    requirements: text('requirements', { mode: 'json' })
      .$type<ProgramRequirements>()
      .notNull()
      .default(sql`'{"ieltsMin":null,"otherTests":[],"documents":[]}'`),
    applicationDeadline: text('application_deadline'),
    /**
     * Bachelor's only: does a Turkmen school-leaver need a pre-year first?
     * yes = no direct entry; no = direct entry; unknown = not confirmed. Null for pre-year programs.
     */
    preYearRequired: text('pre_year_required', { enum: TRI_STATES }),
    ...publicRecord(),
  },
  (t) => [
    uniqueIndex('programs_slug_unique').on(t.slug),
    index('programs_level_university_idx').on(t.level, t.universityId),
    index('programs_field_idx').on(t.field),
    index('programs_published_level_idx').on(t.published, t.level),
    index('programs_university_idx').on(t.universityId),
    index('programs_college_idx').on(t.collegeId),
    check('programs_level', oneOf(t.level, PROGRAM_LEVELS)),
    check('programs_field', sql`${t.field} is null or ${oneOf(t.field, FIELDS)}`),
    check(
      'programs_provider',
      sql`(${t.providerType} = 'university' and ${t.universityId} is not null and ${t.collegeId} is null)
        or (${t.providerType} = 'college' and ${t.collegeId} is not null and ${t.universityId} is null)`,
    ),
    check(
      'programs_pre_year_required',
      sql`(${t.level} = 'bachelor' and ${t.preYearRequired} is not null and ${oneOf(t.preYearRequired, TRI_STATES)})
        or (${t.level} <> 'bachelor' and ${t.preYearRequired} is null)`,
    ),
    check('programs_duration', sql`${t.durationYears} > 0`),
    check('programs_tuition', sql`${t.tuitionPerYearUsd} is null or ${t.tuitionPerYearUsd} >= 0`),
    publishNeedsSource('programs', t),
  ],
);

/**
 * A foundation or language program leading to a bachelor's.
 * The level rules (from = pre-year, to = bachelor's) are enforced by triggers in
 * migrations/0001_pathway_rules.sql, because a CHECK can't look at another row.
 */
export const pathways = sqliteTable(
  'pathways',
  {
    id: integer('id').primaryKey(),
    fromProgramId: integer('from_program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    toProgramId: integer('to_program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    entryGuaranteed: integer('entry_guaranteed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('pathways_from_to_unique').on(t.fromProgramId, t.toProgramId),
    index('pathways_to_idx').on(t.toProgramId),
  ],
);

export const scholarships = sqliteTable(
  'scholarships',
  {
    id: integer('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    coverage: text('coverage', { enum: COVERAGES }).notNull(),
    covers: text('covers', { mode: 'json' })
      .$type<Cover[]>()
      .notNull()
      .default(sql`'[]'`),
    coversPreYear: text('covers_pre_year', { enum: TRI_STATES }).notNull().default('unknown'),
    /** Free text such as "Full tuition + 500 USD a month"; null = amount not confirmed. */
    amountText: text('amount_text'),
    /** Null = no fixed deadline (see `rolling`) or not confirmed. */
    deadline: text('deadline'),
    rolling: integer('rolling', { mode: 'boolean' }).notNull().default(false),
    openToTurkmen: text('open_to_turkmen', { enum: TRI_STATES }).notNull().default('unknown'),
    /** Checklist items in English; translations hold the same list as JSON. */
    eligibility: text('eligibility', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    howToApply: text('how_to_apply'),
    ...publicRecord(),
  },
  (t) => [
    uniqueIndex('scholarships_slug_unique').on(t.slug),
    index('scholarships_deadline_idx').on(t.deadline),
    index('scholarships_published_deadline_idx').on(t.published, t.deadline),
    index('scholarships_country_idx').on(t.countryCode),
    check('scholarships_coverage', oneOf(t.coverage, COVERAGES)),
    check('scholarships_covers_pre_year', oneOf(t.coversPreYear, TRI_STATES)),
    check('scholarships_open_to_turkmen', oneOf(t.openToTurkmen, TRI_STATES)),
    publishNeedsSource('scholarships', t),
  ],
);

export const scholarshipPrograms = sqliteTable(
  'scholarship_programs',
  {
    scholarshipId: integer('scholarship_id')
      .notNull()
      .references(() => scholarships.id, { onDelete: 'cascade' }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.scholarshipId, t.programId] }),
    index('scholarship_programs_program_idx').on(t.programId),
  ],
);

/** A scholarship valid for every bachelor's program at a university. */
export const scholarshipUniversities = sqliteTable(
  'scholarship_universities',
  {
    scholarshipId: integer('scholarship_id')
      .notNull()
      .references(() => scholarships.id, { onDelete: 'cascade' }),
    universityId: integer('university_id')
      .notNull()
      .references(() => universities.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.scholarshipId, t.universityId] }),
    index('scholarship_universities_university_idx').on(t.universityId),
  ],
);

/**
 * Turkmen, Russian and English text for names and long fields.
 * `entity_id` is text so it can hold both numeric ids and country codes.
 */
export const translations = sqliteTable(
  'translations',
  {
    entityType: text('entity_type', { enum: ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    lang: text('lang', { enum: ['tk', 'ru', 'en'] }).notNull(),
    field: text('field').notNull(),
    text: text('text').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.lang, t.field] }),
    check('translations_entity_type', oneOf(t.entityType, ENTITY_TYPES)),
    check('translations_lang', oneOf(t.lang, ['tk', 'ru', 'en'])),
  ],
);

// ---------------------------------------------------------------------------
// Better Auth core tables (user, session, account, verification).
// Field names follow Better Auth's core schema; checked again against its CLI in M3.
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  /** student (default) or admin. Admin is set by hand in the database. */
  role: text('role', { enum: USER_ROLES }).notNull().default('student'),
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Accounts and tracker
// ---------------------------------------------------------------------------

/** Answers to the four quick questions, copied from localStorage on sign-in. */
export interface QuizAnswers {
  countries: string[];
  field: string | null;
  budgetPerYearUsd: number | null;
  englishTest: { name: string; score: string } | null;
}

export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Optional nickname. No real name, age or phone number is ever stored. */
    displayName: text('display_name'),
    preferredLang: text('preferred_lang', { enum: ['tk', 'ru', 'en'] })
      .notNull()
      .default('tk'),
    quiz: text('quiz', { mode: 'json' }).$type<QuizAnswers>(),
    reminderChannel: text('reminder_channel', { enum: REMINDER_CHANNELS })
      .notNull()
      .default('none'),
  },
  (t) => [
    check('profiles_preferred_lang', oneOf(t.preferredLang, ['tk', 'ru', 'en'])),
    check('profiles_reminder_channel', oneOf(t.reminderChannel, REMINDER_CHANNELS)),
  ],
);

export const savedItems = sqliteTable(
  'saved_items',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itemType: text('item_type', { enum: SAVED_ITEM_TYPES }).notNull(),
    itemId: integer('item_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // The primary key starts with user_id, so it is also the saved_items(user_id) index.
    primaryKey({ columns: [t.userId, t.itemType, t.itemId] }),
    check('saved_items_item_type', oneOf(t.itemType, SAVED_ITEM_TYPES)),
  ],
);

/** One application. A pathway is one item with two steps (pre-year, then bachelor's). */
export const trackerItems = sqliteTable(
  'tracker_items',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    programId: integer('program_id').references(() => programs.id),
    pathwayId: integer('pathway_id').references(() => pathways.id),
    scholarshipId: integer('scholarship_id').references(() => scholarships.id),
    stage: text('stage', { enum: TRACKER_STAGES }).notNull().default('planning'),
    notes: text('notes'),
    /** Overrides the program's or scholarship's deadline for this item. */
    deadlineOverride: text('deadline_override'),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index('tracker_items_user_idx').on(t.userId),
    // One item per record per student, even if "Track this" is tapped twice at once.
    // (SQLite lets many rows share a NULL, so each index only bites on its own kind.)
    uniqueIndex('tracker_items_user_program_unique').on(t.userId, t.programId),
    uniqueIndex('tracker_items_user_pathway_unique').on(t.userId, t.pathwayId),
    uniqueIndex('tracker_items_user_scholarship_unique').on(t.userId, t.scholarshipId),
    // The daily reminder run reads only items still before submission.
    index('tracker_items_stage_idx').on(t.stage),
    check('tracker_items_stage', oneOf(t.stage, TRACKER_STAGES)),
    check(
      'tracker_items_target',
      sql`${t.programId} is not null or ${t.pathwayId} is not null or ${t.scholarshipId} is not null`,
    ),
  ],
);

export const trackerTasks = sqliteTable(
  'tracker_tasks',
  {
    id: integer('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => trackerItems.id, { onDelete: 'cascade' }),
    /** The student's own words, or English for a pre-filled task (see `code`). */
    title: text('title').notNull(),
    /**
     * Pre-filled tasks carry a code (e.g. `doc:passport`, `ielts:6.5`), so they show
     * in the reader's language; null for tasks the student added.
     */
    code: text('code'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    dueDate: text('due_date'),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('tracker_tasks_item_idx').on(t.itemId, t.sort)],
);

/** Read-only parent view. Revoking deletes the row. */
export const shareLinks = sqliteTable(
  'share_links',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: SHARE_SCOPES }).notNull(),
    itemId: integer('item_id').references(() => trackerItems.id, { onDelete: 'cascade' }),
    /** The language the parent reads the page in. */
    lang: text('lang', { enum: ['tk', 'ru', 'en'] })
      .notNull()
      .default('tk'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('share_links_user_idx').on(t.userId),
    check('share_links_scope', oneOf(t.scope, SHARE_SCOPES)),
    check(
      'share_links_item',
      sql`(${t.scope} = 'item' and ${t.itemId} is not null) or (${t.scope} = 'tracker' and ${t.itemId} is null)`,
    ),
  ],
);

export const reminderLog = sqliteTable(
  'reminder_log',
  {
    trackerItemId: integer('tracker_item_id')
      .notNull()
      .references(() => trackerItems.id, { onDelete: 'cascade' }),
    daysBefore: integer('days_before').notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.trackerItemId, t.daysBefore] }),
    check('reminder_log_days_before', oneOf(t.daysBefore, REMINDER_DAYS)),
  ],
);

// ---------------------------------------------------------------------------
// Discussions
// ---------------------------------------------------------------------------

export const topics = sqliteTable('topics', {
  slug: text('slug').primaryKey(),
  sort: integer('sort').notNull(),
});

export const threads = sqliteTable(
  'threads',
  {
    id: integer('id').primaryKey(),
    topicSlug: text('topic_slug')
      .notNull()
      .references(() => topics.slug),
    title: text('title').notNull(),
    body: text('body').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    universityId: integer('university_id').references(() => universities.id, {
      onDelete: 'set null',
    }),
    programId: integer('program_id').references(() => programs.id, { onDelete: 'set null' }),
    lang: text('lang', { enum: ['tk', 'ru', 'en'] }).notNull(),
    status: text('status', { enum: POST_STATUSES }).notNull().default('open'),
    helpedReplyId: integer('helped_reply_id').references((): AnySQLiteColumn => replies.id, {
      onDelete: 'set null',
    }),
    replyCount: integer('reply_count').notNull().default(0),
    lastActivityAt: integer('last_activity_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    createdAt: createdAt(),
  },
  (t) => [
    index('threads_topic_activity_idx').on(t.topicSlug, t.lastActivityAt),
    index('threads_university_idx').on(t.universityId),
    index('threads_program_idx').on(t.programId),
    index('threads_author_idx').on(t.authorId, t.createdAt),
    // "New in Discussions" across all boards.
    index('threads_status_activity_idx').on(t.status, t.lastActivityAt),
    check('threads_status', oneOf(t.status, POST_STATUSES)),
    check('threads_lang', oneOf(t.lang, ['tk', 'ru', 'en'])),
  ],
);

export const replies = sqliteTable(
  'replies',
  {
    id: integer('id').primaryKey(),
    threadId: integer('thread_id')
      .notNull()
      .references((): AnySQLiteColumn => threads.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    helpfulCount: integer('helpful_count').notNull().default(0),
    status: text('status', { enum: POST_STATUSES }).notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [
    index('replies_thread_idx').on(t.threadId, t.createdAt),
    index('replies_author_idx').on(t.authorId, t.createdAt),
    check('replies_status', oneOf(t.status, POST_STATUSES)),
  ],
);

/** One helpful vote per user per reply. */
export const replyVotes = sqliteTable(
  'reply_votes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    replyId: integer('reply_id')
      .notNull()
      .references(() => replies.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.replyId] }),
    index('reply_votes_reply_idx').on(t.replyId),
  ],
);

/** Three reports hide a post until an admin reviews it. One report per user per post. */
export const reports = sqliteTable(
  'reports',
  {
    id: integer('id').primaryKey(),
    targetType: text('target_type', { enum: REPORT_TARGETS }).notNull(),
    targetId: integer('target_id').notNull(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    /** Set when an admin keeps the post visible: reviewed reports no longer count toward hiding. */
    reviewed: integer('reviewed', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('reports_target_reporter_unique').on(t.targetType, t.targetId, t.reporterId),
    index('reports_created_idx').on(t.createdAt),
    // The admin queue: posts with reports nobody has reviewed yet.
    index('reports_reviewed_target_idx').on(t.reviewed, t.targetType, t.targetId),
    check('reports_target_type', oneOf(t.targetType, REPORT_TARGETS)),
  ],
);

/** "Studies here" and "Clavis team" badges. Pending requests have verified_at null. */
export const userBadges = sqliteTable(
  'user_badges',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type', { enum: BADGE_TYPES }).notNull(),
    universityId: integer('university_id').references(() => universities.id, {
      onDelete: 'cascade',
    }),
    verifiedBy: text('verified_by').references(() => user.id, { onDelete: 'set null' }),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
    /** The student's short note with a "Studies here" request, for the admin who checks it. */
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('user_badges_user_idx').on(t.userId),
    index('user_badges_pending_idx').on(t.verifiedAt),
    check('user_badges_type', oneOf(t.type, BADGE_TYPES)),
    check(
      'user_badges_university',
      sql`(${t.type} = 'studies_here' and ${t.universityId} is not null) or (${t.type} = 'team' and ${t.universityId} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** From "Report a mistake" on public pages. No user is stored. */
export const mistakeReports = sqliteTable(
  'mistake_reports',
  {
    id: integer('id').primaryKey(),
    entityType: text('entity_type', { enum: ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    message: text('message').notNull(),
    status: text('status', { enum: MISTAKE_STATUSES }).notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [
    index('mistake_reports_status_idx').on(t.status, t.createdAt),
    check('mistake_reports_status', oneOf(t.status, MISTAKE_STATUSES)),
  ],
);

/** Key/value settings, e.g. usd_tmt_rate and usd_tmt_rate_date. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Every admin write. */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey(),
    adminId: text('admin_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    diff: text('diff', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_created_idx').on(t.createdAt),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
);
