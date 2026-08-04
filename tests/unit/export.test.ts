import { describe, it, expect } from 'vitest';
import {
  toCsv,
  sanitizeCell,
  sanitizeGrid,
  columnWidths,
  UTF8_BOM,
  ExportPayloadSchema,
} from '@/lib/list/export';

describe('sanitizeCell — spreadsheet formula injection', () => {
  it('neutralizes a cell starting with =', () => {
    expect(sanitizeCell('=1+1')).toBe("'=1+1");
  });

  it('neutralizes a cell starting with + or @', () => {
    expect(sanitizeCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(sanitizeCell('@import')).toBe("'@import");
  });

  it('neutralizes the classic command payload', () => {
    expect(sanitizeCell('=cmd|/c calc!A1')).toBe("'=cmd|/c calc!A1");
  });

  it('leaves negative numbers alone so real figures survive', () => {
    expect(sanitizeCell('-500')).toBe('-500');
    expect(sanitizeCell('-1.5')).toBe('-1.5');
  });

  it('still neutralizes a leading dash that is not a number', () => {
    expect(sanitizeCell('-=1+1')).toBe("'-=1+1");
  });

  it('leaves ordinary values untouched', () => {
    expect(sanitizeCell('Middle East Technical University')).toBe(
      'Middle East Technical University',
    );
    expect(sanitizeCell('')).toBe('');
    expect(sanitizeCell('$18,000 / 63,180 TMT')).toBe('$18,000 / 63,180 TMT');
  });
});

describe('toCsv — encoding', () => {
  it('starts with a UTF-8 BOM so Excel does not mangle non-Latin names', () => {
    expect(toCsv(['University'], [['Bogazici']]).startsWith(UTF8_BOM)).toBe(true);
  });

  it('round-trips Turkmen and Cyrillic characters unchanged', () => {
    const csv = toCsv(['Uniwersitet'], [['Türkmen Döwlet Uniwersiteti']], );
    expect(csv).toContain('Türkmen Döwlet Uniwersiteti');
    expect(toCsv(['Университет'], [['Мой список']])).toContain('Мой список');
  });
});

describe('toCsv — escaping', () => {
  it('quotes cells containing a comma', () => {
    expect(toCsv(['City'], [['Ankara, Turkey']])).toContain('"Ankara, Turkey"');
  });

  it('doubles embedded quotes', () => {
    expect(toCsv(['Notes'], [['He said "yes"']])).toContain('"He said ""yes"""');
  });

  it('quotes cells containing a newline instead of breaking the row', () => {
    const csv = toCsv(['Notes'], [['line one\nline two']]);
    expect(csv).toContain('"line one\nline two"');
  });

  it('writes the header row first', () => {
    const csv = toCsv(['University', 'Tier'], [['METU', 'Dream']]);
    const [header] = csv.replace(UTF8_BOM, '').split('\r\n');
    expect(header).toBe('University,Tier');
  });

  it('writes one line per row', () => {
    const csv = toCsv(['University'], [['METU'], ['Bogazici']]);
    const lines = csv.replace(UTF8_BOM, '').trim().split('\r\n');
    expect(lines).toEqual(['University', 'METU', 'Bogazici']);
  });

  it('escapes a formula inside a quoted cell too', () => {
    expect(toCsv(['Notes'], [['=HYPERLINK("x"),y']])).toContain('"\'=HYPERLINK(""x""),y"');
  });
});

describe('sanitizeGrid', () => {
  it('puts the headers on the first row', () => {
    expect(sanitizeGrid(['A', 'B'], [['1', '2']])).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('sanitizes header cells as well as body cells', () => {
    expect(sanitizeGrid(['=evil'], [['=also']])).toEqual([["'=evil"], ["'=also"]]);
  });
});

describe('columnWidths', () => {
  it('sizes a column to its longest value', () => {
    const [first] = columnWidths(['A'], [['a much longer value']]);
    expect(first.wch).toBe('a much longer value'.length + 2);
  });

  it('never goes below a readable minimum', () => {
    expect(columnWidths(['A'], [['x']])[0].wch).toBe(10);
  });

  it('caps very long values so one note does not swallow the sheet', () => {
    expect(columnWidths(['A'], [['x'.repeat(500)]])[0].wch).toBe(40);
  });

  it('handles rows shorter than the header list', () => {
    expect(columnWidths(['A', 'B'], [['only-one']])).toHaveLength(2);
  });
});

describe('ExportPayloadSchema', () => {
  it('accepts a well-formed payload', () => {
    const result = ExportPayloadSchema.safeParse({
      format: 'csv',
      headers: ['University'],
      rows: [['METU']],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown format', () => {
    const result = ExportPayloadSchema.safeParse({
      format: 'pdf',
      headers: ['University'],
      rows: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string cells so nothing unexpected reaches the sheet writer', () => {
    const result = ExportPayloadSchema.safeParse({
      format: 'xlsx',
      headers: ['University'],
      rows: [[{ nested: true }]],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with more rows than the list can hold', () => {
    const result = ExportPayloadSchema.safeParse({
      format: 'csv',
      headers: ['University'],
      rows: Array.from({ length: 51 }, () => ['x']),
    });
    expect(result.success).toBe(false);
  });
});
