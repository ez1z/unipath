'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ScholarshipAdminRow } from '@/components/admin/ScholarshipAdminRow';
import { bulkDeleteScholarshipsAction } from '@/app/admin/scholarships/actions';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someFilteredSelected = filtered.some((s) => selectedIds.has(s.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((s) => next.delete(s.id));
      } else {
        filtered.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    const label = ids.length === 1 ? 'scholarship' : 'scholarships';
    if (!confirm(`Delete ${ids.length} ${label}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteScholarshipsAction(ids);
      if (!result.success) alert(`Error: ${result.error}`);
      else setSelectedIds(new Set());
    });
  }

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

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-card border border-border rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'scholarship' : 'scholarships'} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {"Delete selected"}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
          <p className="text-muted-foreground text-sm">{"No scholarships match your filters."}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    aria-label="Select all scholarships"
                    className="rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">{"Scholarship"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Country"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Type"}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <ScholarshipAdminRow
                  key={s.id}
                  scholarship={s}
                  selected={selectedIds.has(s.id)}
                  onToggle={() => toggleOne(s.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
