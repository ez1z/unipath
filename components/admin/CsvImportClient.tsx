'use client';

import { useState, useTransition } from 'react';
import Papa from 'papaparse';
import { CsvRowSchema } from '@/lib/data/university-types';
import { importUniversitiesAction } from '@/app/admin/universities/actions';

const CSV_HEADERS = [
  'name_en', 'name_ru', 'name_tk', 'country', 'city', 'tuition_usd',
  'moe_approved', 'ranking_qs', 'languages', 'majors',
  'official_website', 'application_portal_url', 'entrance_requirements',
];

const CSV_EXAMPLE_ROW: Record<string, string> = {
  name_en: 'Middle East Technical University',
  name_ru: 'METU',
  name_tk: 'ODTU',
  country: 'Turkey',
  city: 'Ankara',
  tuition_usd: '600',
  moe_approved: 'true',
  ranking_qs: '601',
  languages: 'English|Turkish',
  majors: 'Engineering|Computer Science|Architecture',
  official_website: 'https://metu.edu.tr',
  application_portal_url: 'https://oidb.metu.edu.tr',
  entrance_requirements: '{"turkey":{"yos":true}}',
};

type ParsedRow = {
  raw: Record<string, string>;
  index: number;
  errors: string[];
  valid: boolean;
};

function buildCsv(dataRows: Record<string, string>[]) {
  const rows = dataRows.length > 0 ? dataRows : [CSV_EXAMPLE_ROW];
  const csv = Papa.unparse({
    fields: CSV_HEADERS,
    data: rows.map((r) => CSV_HEADERS.map((h) => r[h] ?? '')),
  });
  return csv;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { existingData: Record<string, string>[] };

export function CsvImportClient({ existingData }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const seenNames = new Map<string, number>();
        const parsed: ParsedRow[] = results.data.map((raw, index) => {
          const result = CsvRowSchema.safeParse(raw);
          const errors = result.success
            ? []
            : result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);

          const nameEn = raw.name_en?.trim();
          if (nameEn) {
            if (seenNames.has(nameEn)) {
              errors.push(`name_en: Duplicate — same as row ${seenNames.get(nameEn)! + 1}`);
            } else {
              seenNames.set(nameEn, index);
            }
          }

          return { raw, index, errors, valid: result.success && errors.length === 0 };
        });
        setRows(parsed);
      },
    });
  }

  const invalidCount = rows.filter((r) => !r.valid).length;
  const canImport = rows.length > 0 && invalidCount === 0 && !isPending;

  function handleImport() {
    startTransition(async () => {
      const result = await importUniversitiesAction(rows.map((r) => r.raw));
      if (result.success) {
        setImportResult({ ok: true, message: `Successfully imported ${result.count} universities.` });
        setRows([]);
      } else {
        setImportResult({ ok: false, message: `Import failed: ${result.error}` });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Template */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-2">Step 1: Download current data</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {existingData.length > 0
            ? <>Downloads all <strong>{existingData.length}</strong> existing universities as CSV. Edit the rows, then re-upload — unchanged rows are left as-is.</>
            : <>No universities in the database yet. Downloads a blank template with one example row.</>
          }
          {' '}Use <code className="bg-muted px-1 rounded text-xs">|</code> to separate multiple languages or majors.{' '}
          <code className="bg-muted px-1 rounded text-xs">ranking_qs</code> can be blank.
        </p>
        <button
          onClick={() => triggerDownload(buildCsv(existingData), 'universities.csv')}
          aria-label="Download universities as CSV"
          className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {existingData.length > 0
            ? `Download data (${existingData.length} universities)`
            : 'Download blank template'}
        </button>
      </div>

      {/* Step 2: Upload */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4">Step 2: Upload CSV</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          aria-label="Upload CSV file"
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
        />
      </div>

      {/* Step 3: Preview */}
      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-base">
              Preview — {rows.length} rows
              {invalidCount > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600">({invalidCount} invalid)</span>
              )}
            </h2>
            <button
              onClick={handleImport}
              disabled={!canImport}
              aria-label={`Import ${rows.length} universities`}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'Importing…' : `Import ${rows.length} universities`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">name_en</th>
                  <th className="text-left px-3 py-2 font-medium">country</th>
                  <th className="text-left px-3 py-2 font-medium">tuition_usd</th>
                  <th className="text-left px-3 py-2 font-medium">moe_approved</th>
                  <th className="text-left px-3 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row) => (
                  <tr
                    key={row.index}
                    className={`border-t border-border ${row.valid ? '' : 'bg-red-50'}`}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{row.index + 1}</td>
                    <td className="px-3 py-2">{row.raw.name_en}</td>
                    <td className="px-3 py-2">{row.raw.country}</td>
                    <td className="px-3 py-2">{row.raw.tuition_usd}</td>
                    <td className="px-3 py-2">{row.raw.moe_approved}</td>
                    <td className="px-3 py-2 text-red-600">{row.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2 px-3">
                …and {rows.length - 10} more rows (all validated above)
              </p>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <p
          role="alert"
          className={`text-sm rounded-lg px-4 py-3 border ${
            importResult.ok
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {importResult.message}
        </p>
      )}
    </div>
  );
}
