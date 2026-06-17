/**
 * Parses QS and ARWU ranking files from "uni list/" and generates data/moe-universities.json.
 * Run once: node scripts/parse-moe-list.mjs
 * To update the list, add/edit files in "uni list/" and re-run.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // strip parenthetical abbreviations like "(MIT)"
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = new Map(); // normalized name → { name, country }

function add(name, country) {
  if (!name || typeof name !== 'string') return;
  const n = name.trim();
  if (!n) return;
  const key = normalize(n);
  if (!entries.has(key)) {
    entries.set(key, { name: n, country: (country ?? '').trim() });
  }
}

// ── QS Rankings ──────────────────────────────────────────────────────────────
// Structure: rows 0-2 are headers; data starts at row 3
// Columns: [Index, Rank, Previous Rank, Name, Country/Territory, Region]
console.log('Parsing QS Rankings...');
try {
  const path = join(root, 'uni list', '2026 QS World University Rankings 1.3 (For qs.com) (1).xlsx');
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  let count = 0;
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[3]) continue;
    add(String(row[3]), String(row[4] ?? ''));
    count++;
  }
  console.log(`  ✓ QS: ${count} universities`);
} catch (err) {
  console.error('  ✗ QS parse failed:', err.message);
}

// ── ARWU Rankings ────────────────────────────────────────────────────────────
// Structure: row 0 is header; data alternates [rank, name] / [null, country]
console.log('Parsing ARWU Rankings...');
try {
  const path = join(root, 'uni list', '2026_ARWU_1.xlsx');
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  let count = 0;
  for (let i = 1; i < rows.length; i += 2) {
    const nameRow = rows[i];
    const countryRow = rows[i + 1];
    if (!nameRow || !nameRow[1]) continue;
    const country = countryRow?.[1] ? String(countryRow[1]).trim() : '';
    add(String(nameRow[1]), country);
    count++;
  }
  console.log(`  ✓ ARWU: ${count} universities`);
} catch (err) {
  console.error('  ✗ ARWU parse failed:', err.message);
}

// ── Write output ─────────────────────────────────────────────────────────────
const result = Array.from(entries.values());
const outPath = join(root, 'data', 'moe-universities.json');
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`\nWrote ${result.length} universities to data/moe-universities.json`);
