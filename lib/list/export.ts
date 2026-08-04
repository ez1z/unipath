import { z } from 'zod';
import { MAX_ENTRIES, FIXED_COLUMN_IDS, MAX_CUSTOM_COLUMNS } from '@/lib/data/list-types';

export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const MAX_COLUMNS = FIXED_COLUMN_IDS.length + MAX_CUSTOM_COLUMNS;

/**
 * The client posts the cells it is already displaying rather than ids for the
 * server to re-resolve. That keeps one copy of the display formatting and makes
 * the file match the screen: the user's column order, their hidden columns and
 * their locale come along for free.
 */
export const ExportPayloadSchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  filename: z.string().max(80).optional(),
  headers: z.array(z.string().max(80)).min(1).max(MAX_COLUMNS),
  rows: z.array(z.array(z.string().max(500)).max(MAX_COLUMNS)).max(MAX_ENTRIES),
});

export type ExportPayload = z.infer<typeof ExportPayloadSchema>;

/**
 * Neutralize spreadsheet formula injection.
 *
 * Cells here contain user-authored notes and custom column values, and both
 * Excel and Sheets will execute a cell that opens with `=`, `+` or `@` when the
 * file is opened. A leading apostrophe makes the cell literal text. `-` is only
 * escaped when it is not simply a negative number, so real figures survive.
 */
export function sanitizeCell(value: string): string {
  if (value === '') return value;
  const first = value[0];
  const isFormula =
    first === '=' ||
    first === '+' ||
    first === '@' ||
    first === '\t' ||
    first === '\r' ||
    (first === '-' && !/^-\d/.test(value));
  return isFormula ? `'${value}` : value;
}

function escapeCsvCell(value: string): string {
  const safe = sanitizeCell(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV with a UTF-8 BOM. The BOM is not decoration: without it Excel reads the
 * file in the system codepage and turns Turkmen and Cyrillic university names
 * into mojibake — which is most of this platform's data.
 */
export const UTF8_BOM = '\uFEFF';

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/** Column widths so the .xlsx opens readable instead of a wall of `####`. */
export function columnWidths(headers: string[], rows: string[][]): { wch: number }[] {
  return headers.map((header, i) => {
    const longest = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), header.length);
    return { wch: Math.min(Math.max(longest + 2, 10), 40) };
  });
}

export function sanitizeGrid(headers: string[], rows: string[][]): string[][] {
  return [headers.map(sanitizeCell), ...rows.map((row) => row.map(sanitizeCell))];
}
