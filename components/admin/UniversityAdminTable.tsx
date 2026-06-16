'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { UniversityAdminRow } from '@/components/admin/UniversityAdminRow';
import {
  bulkDeleteUniversitiesAction,
  bulkSetMoeApprovedAction,
} from '@/app/admin/universities/actions';

type RowData = {
  id: string;
  name_en: string;
  country: string;
  moe_approved: boolean;
  created_at: string;
};

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'country-asc'
  | 'moe-first'
  | 'created-desc'
  | 'created-asc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'country-asc', label: 'Country (A–Z)' },
  { value: 'moe-first', label: 'MoE approved first' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
];

export function UniversityAdminTable({ universities }: { universities: RowData[] }) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<SortKey>('name-asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(
    () => Array.from(new Set(universities.map((u) => u.country))).sort(),
    [universities],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = universities.filter((u) => {
      if (country && u.country !== country) return false;
      if (q && !u.name_en.toLowerCase().includes(q)) return false;
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
      case 'moe-first':
        sorted.sort((a, b) => Number(b.moe_approved) - Number(a.moe_approved) || byName(a, b));
        break;
      case 'created-desc':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'created-asc':
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
    }
    return sorted;
  }, [universities, search, country, sort]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const someFilteredSelected = filtered.some((u) => selectedIds.has(u.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((u) => next.delete(u.id));
      } else {
        filtered.forEach((u) => next.add(u.id));
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
    const label = ids.length === 1 ? 'university' : 'universities';
    if (!confirm(`Delete ${ids.length} ${label}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteUniversitiesAction(ids);
      if (!result.success) alert(`Error: ${result.error}`);
      else setSelectedIds(new Set());
    });
  }

  function handleBulkMoe() {
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const result = await bulkSetMoeApprovedAction(ids);
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
          placeholder="Search universities…"
          aria-label="Search universities by name"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter universities by country"
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
          aria-label="Sort universities"
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
            {selectedIds.size} {selectedIds.size === 1 ? 'university' : 'universities'} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={handleBulkMoe}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            {"★ Set MoE Approved"}
          </button>
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
          <p className="text-muted-foreground text-sm">{"No universities match your filters."}</p>
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
                    aria-label="Select all universities"
                    className="rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">{"University"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Country"}</th>
                <th className="text-left px-4 py-3 font-medium">{"MoE Approved"}</th>
                <th className="text-left px-4 py-3 font-medium">{"Created"}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UniversityAdminRow
                  key={u.id}
                  university={u}
                  selected={selectedIds.has(u.id)}
                  onToggle={() => toggleOne(u.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
