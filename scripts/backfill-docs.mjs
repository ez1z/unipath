/**
 * Rewrites `document_checklist_items` rows as `document_progress` diffs.
 *
 * The old table stored a copy of each checklist line, seeded from a template
 * and translated into whatever locale the student happened to be browsing in.
 * The new table stores only what the student changed, against a template that
 * is derived on demand. Reconstructing the diff therefore means matching each
 * old row's name back to the template item it came from — and because the six
 * built-in names were stored translated, that match has to be attempted in all
 * three locales. Postgres cannot call next-intl, which is why this is a script
 * and not a SQL migration.
 *
 * Run once, after 20260804010000_document_progress.sql and BEFORE
 * 20260804020000_drop_document_checklist_items.sql:
 *
 *   node scripts/backfill-docs.mjs           # report only, writes nothing
 *   node scripts/backfill-docs.mjs --apply   # write document_progress rows
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const LOCALES = ['tk', 'ru', 'en'];
const DEFAULT_DOC_KEYS = [
  'default_passport',
  'default_transcript',
  'default_recommendation_letters',
  'default_toefl',
  'default_sat',
  'default_visa_documents',
];

const apply = process.argv.includes('--apply');

/* ---------------------------------------------------------------- *
 * Environment — .env.local is not loaded for plain node scripts
 * ---------------------------------------------------------------- */

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, '');
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key);

/* ---------------------------------------------------------------- *
 * Template reconstruction
 * ---------------------------------------------------------------- */

const normalize = (s) => s.trim().toLowerCase();

/** Every translation of every built-in name, mapped back to its stable id. */
function defaultNameLookup() {
  const lookup = new Map();
  for (const locale of LOCALES) {
    const messages = JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
    const checklist = messages.checklist ?? {};
    for (const docKey of DEFAULT_DOC_KEYS) {
      const name = checklist[docKey];
      if (typeof name === 'string' && name.trim()) lookup.set(normalize(name), `d:${docKey}`);
    }
  }
  return lookup;
}

function templateFor(university, defaults) {
  const raw = university?.entrance_requirements?.document_requirements;

  if (Array.isArray(raw)) {
    const lookup = new Map();
    const ids = [];
    for (const value of raw) {
      if (typeof value !== 'string') continue;
      const name = value.trim().slice(0, 120);
      if (!name) continue;
      const id = `t:${name}`;
      if (lookup.has(normalize(name))) continue;
      lookup.set(normalize(name), id);
      ids.push(id);
    }
    if (ids.length > 0) return { lookup, ids };
  }

  return { lookup: defaults, ids: DEFAULT_DOC_KEYS.map((k) => `d:${k}`) };
}

/* ---------------------------------------------------------------- *
 * Main
 * ---------------------------------------------------------------- */

const { data: items, error: itemsError } = await supabase
  .from('document_checklist_items')
  .select('user_id, university_id, name, is_checked, sort_order')
  .order('sort_order');

if (itemsError) {
  console.error('Could not read document_checklist_items:', itemsError.message);
  process.exit(1);
}

if (!items || items.length === 0) {
  console.log('No document_checklist_items rows. Nothing to back up — drop the table freely.');
  process.exit(0);
}

const universityIds = [...new Set(items.map((i) => i.university_id))];
const { data: universities, error: uniError } = await supabase
  .from('universities')
  .select('id, entrance_requirements')
  .in('id', universityIds);

if (uniError) {
  console.error('Could not read universities:', uniError.message);
  process.exit(1);
}

const universitiesById = new Map((universities ?? []).map((u) => [u.id, u]));
const defaults = defaultNameLookup();

// Group by (user, university) — one diff per pair, which is the new primary key.
const groups = new Map();
for (const item of items) {
  const groupKey = `${item.user_id}|${item.university_id}`;
  if (!groups.has(groupKey)) groups.set(groupKey, []);
  groups.get(groupKey).push(item);
}

const rows = [];
let matched = 0;
let orphaned = 0;

for (const [groupKey, groupItems] of groups) {
  const [userId, universityId] = groupKey.split('|');
  const { lookup, ids: templateIds } = templateFor(universitiesById.get(universityId), defaults);

  const checked = [];
  const custom = [];
  const seenTemplateIds = new Set();

  for (const item of groupItems.sort((a, b) => a.sort_order - b.sort_order)) {
    const templateId = lookup.get(normalize(item.name));

    if (templateId) {
      seenTemplateIds.add(templateId);
      if (item.is_checked) checked.push(templateId);
      matched++;
    } else {
      // A name the template never had: either the student typed it, or an admin
      // has since reworded the requirement. Either way it survives as a custom
      // item, so nothing the student wrote is lost.
      const id = `c:${randomUUID()}`;
      custom.push({ id, name: item.name.slice(0, 120) });
      if (item.is_checked) checked.push(id);
      orphaned++;
    }
  }

  // A template item with no row means the student deleted it.
  const removed = templateIds.filter((id) => !seenTemplateIds.has(id));

  rows.push({ user_id: userId, university_id: universityId, checked, removed, custom: custom.slice(0, 20) });
}

console.log(`${items.length} items across ${groups.size} (user, university) pairs`);
console.log(`  ${matched} matched a template item`);
console.log(`  ${orphaned} kept as custom items (student-added, or requirement reworded)`);
console.log(`  ${rows.reduce((n, r) => n + r.removed.length, 0)} template items recorded as deleted`);

if (!apply) {
  console.log('\nDry run. Re-run with --apply to write document_progress rows.');
  process.exit(0);
}

for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  const { error } = await supabase
    .from('document_progress')
    .upsert(batch, { onConflict: 'user_id,university_id' });

  if (error) {
    console.error(`Batch starting at ${i} failed:`, error.message);
    process.exit(1);
  }
}

console.log(`\nWrote ${rows.length} document_progress rows.`);
console.log('Safe to apply 20260804020000_drop_document_checklist_items.sql now.');
