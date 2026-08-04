import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  ExportPayloadSchema,
  toCsv,
  sanitizeGrid,
  columnWidths,
} from '@/lib/list/export';

export const dynamic = 'force-dynamic';

/**
 * Generates the download from the rows the client is displaying.
 *
 * POST rather than a GET that reads the database: guests have no server-side
 * rows, and one code path for both signed-in and signed-out users is worth more
 * than the tidiness of a shareable export URL.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ExportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const { format, headers, rows } = parsed.data;
  const base = (parsed.data.filename ?? 'unipath-list').replace(/[^\w-]/g, '') || 'unipath-list';

  if (format === 'csv') {
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"`,
      },
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet(sanitizeGrid(headers, rows));
  sheet['!cols'] = columnWidths(headers, rows);

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'My List');

  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${base}.xlsx"`,
    },
  });
}
