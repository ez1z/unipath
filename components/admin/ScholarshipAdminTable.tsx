'use client';

import { useMemo, useState } from 'react';
import { ScholarshipAdminRow } from '@/components/admin/ScholarshipAdminRow';

type RowData = {
  id: string;
  name_en: string;
  country: string;
  type: string;
  created_at: string;
};

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'country-asc'
  | 'type-asc'
  | 'created-desc'
  | 'created-asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'country-asc', label: 'Country (A–Z)' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'type-asc', label: 'Type (A–Z)' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
];

export function ScholarshipAdminTable({ scholarships }: { scholarships: RowData[] }) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<SortKey>('country-asc');

  const countries = useMemo(
    () => Array.from(new Set(scholarships.map((s) => s.country))).sort(),
    [scholarships],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = scholarships.filter((s) => {
      if (country && s.country !== country) return false;
      if (q && !s.name_en.toLowerCase().includes(q)) return false;
      return true;
    });

    const byName = (a: RowData, b: RowData) => a.name_en.localeCompare(b.name_en);
    const sorted = [...rows];
    switch (sort) {
      case 'name-asc':
        sorted.sort(byName);
        break;
      case 'name-desc':
        sorted.sort((a, b) => byName(b, a));
        break;
      case 'country-asc':
        sorted.sort((a, b) => a.country.localeCompare(b.country) || byName(a, b));
        break;
      case 'type-asc':
        sorted.sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
        break;
      case 'created-desc':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'created-asc':
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
    }
    return sorted;
  }, [scholarships, search, country, sort]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scholarships…"
          aria-label="Search scholarships by name"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter scholarships by country"
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-56"
        >
          <option value="">{"All countries"}</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort scholarships"
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-56"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
          <p className="text-muted-foreground text-sm">{"No scholarships match your filters."}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{"Scholarship"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Country"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Type"}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <ScholarshipAdminRow key={s.id} scholarship={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
