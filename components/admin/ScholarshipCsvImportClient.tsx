'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { ScholarshipCsvRowSchema } from '@/lib/data/scholarship-types';
import { importScholarshipsAction } from '@/app/admin/scholarships/actions';

const CSV_HEADERS = [
  'name_en', 'name_ru', 'name_tk', 'country', 'university_name_en',
  'type', 'coverage', 'amount_usd', 'deadline_text', 'semesters',
  'description_en', 'description_ru', 'description_tk', 'application_url',
];

const CSV_EXAMPLE_ROW: Record<string, string> = {
  name_en: 'Türkiye Scholarships',
  name_ru: 'Стипендии Турции',
  name_tk: 'Türkiye Stipendiýalary',
  country: 'Turkey',
  university_name_en: '',
  type: 'government',
  coverage: 'tuition|accommodation|stipend|flights|health',
  amount_usd: '8000',
  deadline_text: 'February 20',
  semesters: 'Fall 2026:2026-09-01:2026-02-20|Spring 2027:2027-02-01:2026-11-15',
  description_en: 'Full scholarship for international students.',
  description_ru: 'Полная стипендия для иностранных студентов.',
  description_tk: 'Daşary ýurt talyplary üçin doly stipendiýa.',
  application_url: 'https://turkiyeburslari.gov.tr',
};

type ParsedRow = {
  raw: Record<string, string>;
  index: number;
  errors: string[];
  valid: boolean;
};

function buildCsv(dataRows: Record<string, string>[]) {
  const rows = dataRows.length > 0 ? dataRows : [CSV_EXAMPLE_ROW];
  return Papa.unparse({
    fields: CSV_HEADERS,
    data: rows.map((r) => CSV_HEADERS.map((h) => r[h] ?? '')),
  });
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

export function ScholarshipCsvImportClient({ existingData }: Props) {
  const t = useTranslations('admin');
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
        const parsed: ParsedRow[] = results.data.map((raw, index) => {
          const result = ScholarshipCsvRowSchema.safeParse(raw);
          const errors = result.success
            ? []
            : result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
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
      const result = await importScholarshipsAction(rows.map((r) => r.raw));
      if (result.success) {
        setImportResult({ ok: true, message: t('csv_success_sch', { count: result.count }) });
        setRows([]);
      } else {
        setImportResult({ ok: false, message: t('csv_error', { error: result.error ?? '' }) });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Template */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-2">{t('csv_step1_title')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {existingData.length > 0
            ? t('csv_sch_step1_has_data', { count: existingData.length })
            : t('csv_sch_step1_empty')
          }
          {' '}Use <code className="bg-muted px-1 rounded text-xs">|</code> to separate multiple values (coverage).{' '}
          Leave <code className="bg-muted px-1 rounded text-xs">university_name_en</code> blank for country-wide scholarships.
        </p>
        <button
          onClick={() => triggerDownload(buildCsv(existingData), 'scholarships.csv')}
          aria-label="Download scholarships as CSV"
          className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {existingData.length > 0
            ? t('csv_download_data_sch', { count: existingData.length })
            : t('csv_download_template')}
        </button>
      </div>

      {/* Step 2: Upload */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-heading font-semibold text-base mb-4">{t('csv_step2_title')}</h2>
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
              {t('csv_preview_title', { count: rows.length })}
              {invalidCount > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600">{t('csv_invalid_count', { count: invalidCount })}</span>
              )}
            </h2>
            <button
              onClick={handleImport}
              disabled={!canImport}
              aria-label={t('csv_import_sch_button', { count: rows.length })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? t('csv_importing') : t('csv_import_sch_button', { count: rows.length })}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">name_en</th>
                  <th className="text-left px-3 py-2 font-medium">country</th>
                  <th className="text-left px-3 py-2 font-medium">type</th>
                  <th className="text-left px-3 py-2 font-medium">coverage</th>
                  <th className="text-left px-3 py-2 font-medium">{t('csv_col_issues')}</th>
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
                    <td className="px-3 py-2">{row.raw.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.raw.coverage || '—'}</td>
                    <td className="px-3 py-2 text-red-600">{row.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2 px-3">
                {t('csv_more_rows', { count: rows.length - 10 })}
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
