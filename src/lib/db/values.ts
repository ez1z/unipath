/**
 * Allowed values for enum-like columns. The schema turns each list into a CHECK
 * constraint, and filters and admin forms validate against the same lists.
 * Labels for these codes live in src/i18n (added with the screens that show them).
 */

export const PROGRAM_LEVELS = ['bachelor', 'foundation', 'language'] as const;
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

/** Levels that count as a pre-year (the `from` side of a pathway). */
export const PRE_YEAR_LEVELS = [
  'foundation',
  'language',
] as const satisfies readonly ProgramLevel[];
export type PreYearLevel = (typeof PRE_YEAR_LEVELS)[number];

export const PROVIDER_TYPES = ['university', 'college'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const MINISTRY_STATUSES = ['approved', 'not_listed', 'unchecked'] as const;
export type MinistryStatus = (typeof MINISTRY_STATUSES)[number];

export const UNIVERSITY_TYPES = ['public', 'private'] as const;
export type UniversityType = (typeof UNIVERSITY_TYPES)[number];

/** Fields of study, used by the "field" filter. Language years have no field. */
export const FIELDS = [
  'business',
  'computing',
  'engineering',
  'medicine',
  'law',
  'sciences',
  'social_sciences',
  'arts',
  'education',
  'architecture',
] as const;
export type Field = (typeof FIELDS)[number];

/** yes / no / unknown facts. Unknown is shown as unknown, never guessed. */
export const TRI_STATES = ['yes', 'no', 'unknown'] as const;
export type TriState = (typeof TRI_STATES)[number];

export const COVERAGES = ['full', 'partial'] as const;
export type Coverage = (typeof COVERAGES)[number];

/** What a scholarship pays for (`scholarships.covers`). */
export const COVERS = ['tuition', 'stipend', 'housing', 'flights', 'insurance'] as const;
export type Cover = (typeof COVERS)[number];

/** Documents a program asks for (`programs.requirements.documents`). Tracker tasks are made from these. */
export const DOCUMENTS = [
  'passport',
  'school_certificate',
  'transcript',
  'motivation_letter',
  'recommendation_letter',
  'cv',
  'portfolio',
  'medical_certificate',
  'photos',
  'application_fee',
] as const;
export type DocumentCode = (typeof DOCUMENTS)[number];

export const SAVED_ITEM_TYPES = ['program', 'university', 'scholarship'] as const;
export type SavedItemType = (typeof SAVED_ITEM_TYPES)[number];

export const TRACKER_STAGES = [
  'planning',
  'preparing',
  'submitted',
  'accepted',
  'waitlisted',
  'rejected',
  'enrolled',
] as const;
export type TrackerStage = (typeof TRACKER_STAGES)[number];

export const SHARE_SCOPES = ['tracker', 'item'] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];

export const REMINDER_DAYS = [30, 7, 1] as const;
export type ReminderDays = (typeof REMINDER_DAYS)[number];

export const REMINDER_CHANNELS = ['email', 'telegram', 'none'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const USER_ROLES = ['student', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const POST_STATUSES = ['open', 'hidden'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const REPORT_TARGETS = ['thread', 'reply'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const BADGE_TYPES = ['studies_here', 'team'] as const;
export type BadgeType = (typeof BADGE_TYPES)[number];

export const MISTAKE_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

/** Entity types that carry translated text in `translations`. */
export const ENTITY_TYPES = [
  'country',
  'university',
  'college',
  'program',
  'scholarship',
  'topic',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** The six discussion boards, in display order. */
export const TOPIC_SLUGS = [
  'choosing-a-country',
  'scholarships',
  'documents-and-visas',
  'tests',
  'life-abroad',
  'for-parents',
] as const;
