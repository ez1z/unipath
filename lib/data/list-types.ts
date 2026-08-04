import { z } from 'zod';

export const TIERS = ['dream', 'target', 'safety'] as const;
export type Tier = (typeof TIERS)[number];

export const STATUSES = ['planning', 'applying', 'applied', 'accepted', 'rejected'] as const;
export type Status = (typeof STATUSES)[number];

export const MAX_ENTRIES = 50;
export const MAX_CUSTOM_COLUMNS = 10;
export const MAX_CUSTOM_VALUE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 2000;

/* ------------------------------------------------------------------ *
 * Columns
 *
 * Fixed and custom columns share one ordered array so that ordering,
 * hiding and defining are a single mechanism: moving a column is an
 * array splice regardless of which kind it is.
 * ------------------------------------------------------------------ */

export const FIXED_COLUMN_IDS = [
  'university',
  'tier',
  'status',
  'deadline',
  'tuition',
  'scholarships',
  'net_cost',
  'docs',
  'moe',
  'ranking',
  'acceptance',
  'flags',
  'notes',
] as const;
export type FixedColumnId = (typeof FIXED_COLUMN_IDS)[number];

/** The row's identity: always first, never hidden. */
export const PINNED_COLUMN_ID: FixedColumnId = 'university';

export const CUSTOM_COLUMN_TYPES = ['text', 'number', 'checkbox'] as const;
export type CustomColumnType = (typeof CUSTOM_COLUMN_TYPES)[number];

export type FixedColumn = { id: FixedColumnId; kind: 'fixed'; hidden?: boolean };
export type CustomColumn = {
  id: string;
  kind: 'custom';
  name: string;
  type: CustomColumnType;
  hidden?: boolean;
};
export type ColumnDef = FixedColumn | CustomColumn;

/**
 * Columns that start hidden.
 *
 * All thirteen at once produce a ~2400px table: everything is cramped, and the
 * student has to scroll sideways to reach the fields they actually edit. These
 * five answer questions that the university's own page answers better, so they
 * are one click away in the column manager instead of always on screen.
 */
export const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<FixedColumnId> = new Set([
  'net_cost',
  'moe',
  'ranking',
  'acceptance',
  'flags',
]);

export const DEFAULT_COLUMNS: ColumnDef[] = FIXED_COLUMN_IDS.map((id) => ({
  id,
  kind: 'fixed',
  ...(DEFAULT_HIDDEN_COLUMNS.has(id) ? { hidden: true } : {}),
}));

const FixedColumnSchema = z.object({
  id: z.enum(FIXED_COLUMN_IDS),
  kind: z.literal('fixed'),
  hidden: z.boolean().optional(),
});

const CustomColumnSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.literal('custom'),
  name: z.string().min(1).max(40),
  type: z.enum(CUSTOM_COLUMN_TYPES),
  hidden: z.boolean().optional(),
});

export const ColumnDefSchema = z.discriminatedUnion('kind', [FixedColumnSchema, CustomColumnSchema]);

export const ColumnLayoutSchema = z
  .array(ColumnDefSchema)
  .max(FIXED_COLUMN_IDS.length + MAX_CUSTOM_COLUMNS);

/**
 * Make any stored layout safe to render.
 *
 * Layouts are user data that outlives releases, so this has to survive
 * columns we removed (drop them) and columns we added after the layout was
 * saved (append them) without ever losing the user's ordering.
 */
export function normalizeColumns(raw: unknown): ColumnDef[] {
  const parsed = ColumnLayoutSchema.safeParse(raw);
  const stored = parsed.success ? parsed.data : [];

  const seen = new Set<string>();
  const kept: ColumnDef[] = [];

  for (const col of stored) {
    if (seen.has(col.id)) continue;
    seen.add(col.id);
    kept.push(col);
  }

  // Fixed columns introduced since this layout was saved go to the end, in
  // their default visibility — a column the user has never seen should not
  // appear mid-table without them asking for it.
  for (const id of FIXED_COLUMN_IDS) {
    if (!seen.has(id)) {
      kept.push({ id, kind: 'fixed', hidden: DEFAULT_HIDDEN_COLUMNS.has(id) });
    }
  }

  const customCount = kept.filter((c) => c.kind === 'custom').length;
  const trimmed =
    customCount <= MAX_CUSTOM_COLUMNS
      ? kept
      : kept.filter((c, i) => c.kind === 'fixed' || i < indexOfNthCustom(kept, MAX_CUSTOM_COLUMNS));

  // The row identity column is pinned first and always visible.
  const pinned = trimmed.find((c) => c.id === PINNED_COLUMN_ID) ?? {
    id: PINNED_COLUMN_ID,
    kind: 'fixed' as const,
  };
  const rest = trimmed.filter((c) => c.id !== PINNED_COLUMN_ID);

  return [{ ...pinned, hidden: false } as ColumnDef, ...rest];
}

function indexOfNthCustom(cols: ColumnDef[], n: number): number {
  let count = 0;
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].kind === 'custom' && ++count > n) return i;
  }
  return cols.length;
}

export function visibleColumns(cols: ColumnDef[]): ColumnDef[] {
  return cols.filter((c) => !c.hidden);
}

/* ------------------------------------------------------------------ *
 * Entries
 * ------------------------------------------------------------------ */

export const MAX_SEMESTER_KEY_LENGTH = 200;

export type ListEntry = {
  university_id: string;
  tier: Tier | null;
  status: Status;
  scholarship_ids: string[];
  notes: string | null;
  /** `name|start_date` of the chosen intake; null means "use the nearest deadline". */
  semester_key: string | null;
  custom: Record<string, string | number | boolean>;
  sort_order: number;
};

export type ListEntryDbRow = {
  university_id: string;
  tier: string | null;
  status: string;
  scholarship_ids: string[] | null;
  notes: string | null;
  semester_key: string | null;
  custom: unknown;
  sort_order: number;
};

const CustomValuesSchema = z.record(
  z.string().max(64),
  z.union([z.string().max(MAX_CUSTOM_VALUE_LENGTH), z.number(), z.boolean()]),
);

export const ListEntrySchema = z.object({
  university_id: z.string().uuid(),
  tier: z.enum(TIERS).nullable().default(null),
  status: z.enum(STATUSES).default('planning'),
  scholarship_ids: z.array(z.string().uuid()).max(20).default([]),
  notes: z.string().max(MAX_NOTES_LENGTH).nullable().default(null),
  semester_key: z.string().max(MAX_SEMESTER_KEY_LENGTH).nullable().default(null),
  custom: CustomValuesSchema.default({}),
  sort_order: z.number().int().min(0).default(0),
});

export const ListEntriesSchema = z.array(ListEntrySchema).max(MAX_ENTRIES);

export function dbRowToListEntry(row: ListEntryDbRow): ListEntry {
  return {
    university_id: row.university_id,
    tier: (TIERS as readonly string[]).includes(row.tier ?? '') ? (row.tier as Tier) : null,
    status: (STATUSES as readonly string[]).includes(row.status)
      ? (row.status as Status)
      : 'planning',
    scholarship_ids: row.scholarship_ids ?? [],
    notes: row.notes,
    semester_key: row.semester_key,
    custom: CustomValuesSchema.safeParse(row.custom).data ?? {},
    sort_order: row.sort_order,
  };
}

export function newEntry(universityId: string, sortOrder: number): ListEntry {
  return {
    university_id: universityId,
    tier: null,
    status: 'planning',
    scholarship_ids: [],
    notes: null,
    semester_key: null,
    custom: {},
    sort_order: sortOrder,
  };
}
