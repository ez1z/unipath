/**
 * Parses THE, QS, ARWU and MosIU (Moscow "Three University Missions") ranking files
 * from "uni list/" and generates data/moe-universities.json.
 *
 * Per the MoE decision, a university is transfer-eligible if it ranks in the top 1000
 * of at least one of the 4 rankings. The result is the deduplicated union of all 4
 * top-1000 lists.
 *
 * Run once: node scripts/parse-moe-list.mjs
 * To update the list, replace the files in "uni list/" and re-run.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const RANK_CUTOFF = 1000;

// Confirmed same-institution name variants across the 4 source lists (normalized keys).
// Needed because each ranking spells some university names differently.
const ALIASES = new Map([
  ['agh university of krakow', 'agh university of science and technology'],
  ['applied science private university jordan', 'applied science private university'],
  ['ben gurion university', 'ben gurion university of the negev'],
  ['birla institute of technology and science', 'birla institute of technology and science pilani'],
  ['central queensland university', 'central queensland university australia cquniversity'],
  ['china medical university', 'china medical university taiwan'],
  ['czech university of life sciences in prague', 'czech university of life sciences prague czu'],
  ['ecole normale superieure lyon', 'ecole normale superieure de lyon'],
  ['friedrich schiller university jena', 'friedrich schiller university of jena'],
  ['heinrich heine university duesseldorf', 'heinrich heine university dusseldorf'],
  ['jamia millia islamia', 'jamia millia islamia new delhi'],
  ['johannes kepler university linz', 'johannes kepler university of linz'],
  ['manipal academy of higher education', 'manipal academy of higher education manipal university mahe'],
  ['montana state university', 'montana state university bozeman'],
  ['moscow institute of physics and technology mipt', 'moscow institute of physics and technology state university'],
  ['nanyang technological university', 'nanyang technological university singapore'],
  ['national university of science and technology', 'national university of science and technology misis'],
  ['nicolaus copernicus university', 'nicolaus copernicus university in torun'],
  ['north carolina state university', 'north carolina state university at raleigh'],
  ['ohio state university main campus', 'ohio state university columbus'],
  ['scuola normale superiore pisa', 'scuola normale superiore di pisa'],
  ['tashkent institute of irrigation and agricultural mechanisation', 'tashkent institute of irrigation and agricultural mechanization engineers national research university tiiame nru'],
  ['trinity college dublin', 'trinity college dublin the university of dublin'],
  ['universidade estadual paulista julio de mesquita filho unesp', 'universidade estadual paulista unesp'],
  ['university at buffalo', 'university at buffalo suny'],
  ['university at buffalo the state university of new york', 'university at buffalo suny'],
  ['university of bari', 'university of bari aldo moro'],
  ['university of delhi', 'university of delhi delhi'],
  ['university of galway', 'university of galway ollscoil na gaillimhe'],
  ['university of illinois chicago', 'university of illinois at chicago'],
  ['university of illinois urbana champaign', 'university of illinois at urbana champaign'],
  ['university of michigan', 'university of michigan ann arbor'],
  ['university of minnesota', 'university of minnesota twin cities'],
  ['university of new brunswick', 'university of new brunswick unb'],
  ['university of north carolina chapel hill', 'university of north carolina at chapel hill'],
  ['university of oklahoma', 'university of oklahoma norman'],
  ['university of rome ii tor vergata', 'university of rome tor vergata'],
  ['university of santiago compostela', 'university of santiago de compostela'],
  ['vellore institute of technology', 'vellore institute of technology vit vellore india'],
]);

function normalize(s) {
  const key = s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(.*?\)/g, '') // strip parenthetical abbreviations like "(MIT)"
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES.get(key) ?? key;
}

const entries = new Map(); // normalized name -> { name, country }

function add(name, country) {
  if (!name || typeof name !== 'string') return;
  const n = name.trim();
  if (!n) return;
  const key = normalize(n);
  if (!key) return;
  if (!entries.has(key)) {
    entries.set(key, { name: n, country: (country ?? '').trim() });
  }
}

// ── THE World University Rankings ───────────────────────────────────────────
// Structure: row 0 header; each row is [Rank, "Name" + "Country" concatenated with no separator]
console.log('Parsing THE Rankings...');
try {
  const THE_COUNTRIES = [
    'Bosnia and Herzegovina', 'United Arab Emirates', 'Trinidad and Tobago', 'Republic of Ireland',
    'Papua New Guinea', 'South Africa', 'New Zealand', 'South Korea', 'North Macedonia', 'Saudi Arabia',
    'Czech Republic', 'United Kingdom', 'United States', 'Sri Lanka', 'North Cyprus', 'Puerto Rico',
    'Costa Rica', 'Hong Kong', 'Dominican Republic', 'Northern Cyprus',
    'China', 'Macau', 'Macao', 'Taiwan', 'Japan', 'India', 'Iran', 'Iraq', 'Israel', 'Italy', 'Egypt',
    'Chile', 'Brazil', 'Mexico', 'Turkey', 'Türkiye', 'Poland', 'Russian Federation', 'Russia', 'Kazakhstan', 'Uzbekistan',
    'Azerbaijan', 'Georgia', 'Armenia', 'Cyprus', 'Malta', 'Luxembourg', 'Iceland', 'Bangladesh', 'Nepal',
    'Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Morocco', 'Tunisia', 'Algeria', 'Jordan', 'Lebanon',
    'Kuwait', 'Oman', 'Bahrain', 'Qatar', 'Ecuador', 'Uruguay', 'Venezuela', 'Panama', 'Cuba', 'Guatemala',
    'Honduras', 'Paraguay', 'Montenegro', 'Albania', 'Moldova', 'Belarus', 'Mongolia', 'Brunei', 'Palestine',
    'Slovenia', 'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Serbia', 'Romania', 'Bulgaria', 'Ukraine',
    'Croatia', 'Colombia', 'Argentina', 'Peru', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam',
    'Pakistan', 'Singapore', 'Switzerland', 'Australia', 'Austria', 'Belgium', 'Ireland', 'Denmark', 'Finland',
    'Norway', 'Sweden', 'Germany', 'France', 'Spain', 'Portugal', 'Greece', 'Hungary', 'Netherlands', 'Canada',
    'Zimbabwe', 'Zambia', 'Botswana', 'Namibia', 'Rwanda', 'Ethiopia', 'Senegal', 'Cameroon', 'Fiji', 'Cambodia',
    'Laos', 'Myanmar', 'Bhutan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Afghanistan', 'Yemen', 'Syria',
    'Libya', 'Sudan', 'Bermuda', 'Jamaica', 'Barbados', 'Czechia', 'Brunei Darussalam', 'Mozambique',
    'Mauritius', 'Kosovo',
  ].sort((a, b) => b.length - a.length);

  function splitTheNameCountry(s) {
    for (const c of THE_COUNTRIES) {
      if (s.endsWith(c) && s.length > c.length) {
        return { name: s.slice(0, s.length - c.length).trim(), country: c };
      }
    }
    return null;
  }

  const path = join(root, 'uni list', '2026_THE_World_University_Rankings.xlsx');
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const [rank, raw] = rows[i];
    if (!raw || parseInt(rank, 10) > RANK_CUTOFF) continue;
    const split = splitTheNameCountry(String(raw));
    if (!split) {
      console.warn(`  ! THE: could not split name/country for "${raw}"`);
      continue;
    }
    add(split.name, split.country);
    count++;
  }
  console.log(`  ✓ THE: ${count} universities`);
} catch (err) {
  console.error('  ✗ THE parse failed:', err.message);
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
    const rank = parseInt(String(row[1]).replace(/[^0-9-]/g, '').split('-')[0], 10);
    if (rank > RANK_CUTOFF) continue;
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
    const rank = parseInt(String(nameRow[0]).split('-')[0], 10);
    if (rank > RANK_CUTOFF) continue;
    const country = countryRow?.[1] ? String(countryRow[1]).trim() : '';
    add(String(nameRow[1]), country);
    count++;
  }
  console.log(`  ✓ ARWU: ${count} universities`);
} catch (err) {
  console.error('  ✗ ARWU parse failed:', err.message);
}

// ── MosIU "Three University Missions" Ranking ───────────────────────────────
// PDF table, Appendix 1: rows are "rank[-rank]\tName\tCountry (Russian)"
console.log('Parsing MosIU Rankings...');
try {
  const RU_TO_EN = {
    'Австралия': 'Australia', 'Австрия': 'Austria', 'Аргентина': 'Argentina', 'Армения': 'Armenia',
    'Бангладеш': 'Bangladesh', 'Беларусь': 'Belarus', 'Бельгия': 'Belgium', 'Болгария': 'Bulgaria',
    'Бразилия': 'Brazil', 'Великобритания': 'United Kingdom', 'Венгрия': 'Hungary', 'Германия': 'Germany',
    'Греция': 'Greece', 'Дания': 'Denmark', 'Египет': 'Egypt', 'Израиль': 'Israel', 'Индия': 'India',
    'Индонезия': 'Indonesia', 'Иран': 'Iran', 'Ирландия': 'Ireland', 'Исландия': 'Iceland', 'Испания': 'Spain',
    'Италия': 'Italy', 'Казахстан': 'Kazakhstan', 'Канада': 'Canada', 'Катар': 'Qatar', 'Кипр': 'Cyprus',
    'Китай': 'China', 'Китай (Гонконг)': 'Hong Kong', 'Китай (Макао)': 'Macau', 'Китай (Тайвань)': 'Taiwan',
    'Колумбия': 'Colombia', 'Коста-Рика': 'Costa Rica', 'Латвия': 'Latvia', 'Ливан': 'Lebanon',
    'Литва': 'Lithuania', 'Лихтенштейн': 'Liechtenstein', 'Люксембург': 'Luxembourg', 'Малайзия': 'Malaysia',
    'Мальта': 'Malta', 'Мексика': 'Mexico', 'Молдавия': 'Moldova', 'Нидерланды': 'Netherlands',
    'Новая Зеландия': 'New Zealand', 'Норвегия': 'Norway', 'ОАЭ': 'United Arab Emirates', 'Пакистан': 'Pakistan',
    'Перу': 'Peru', 'Польша': 'Poland', 'Португалия': 'Portugal', 'Пуэрто-Рико': 'Puerto Rico',
    'Россия': 'Russia', 'Румыния': 'Romania', 'США': 'United States', 'Саудовская Аравия': 'Saudi Arabia',
    'Сингапур': 'Singapore', 'Словакия': 'Slovakia', 'Словения': 'Slovenia', 'Таиланд': 'Thailand',
    'Турция': 'Turkey', 'Украина': 'Ukraine', 'Филиппины': 'Philippines', 'Финляндия': 'Finland',
    'Франция': 'France', 'Хорватия': 'Croatia', 'Чехия': 'Czechia', 'Чили': 'Chile', 'Швейцария': 'Switzerland',
    'Швеция': 'Sweden', 'Эстония': 'Estonia', 'ЮАР': 'South Africa', 'Южная Корея': 'South Korea', 'Япония': 'Japan',
  };

  const path = join(root, 'uni list', 'document (3).pdf');
  const buf = readFileSync(path);
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  const text = data.text;
  // Appendix 1 (full ranking) precedes Appendix 2 (Russian universities' positions); only parse Appendix 1
  const firstIdx = text.indexOf('Приложение 2');
  const appendix2Idx = text.indexOf('Приложение 2', firstIdx + 1);
  const appendix1Text = appendix2Idx === -1 ? text : text.slice(0, appendix2Idx);
  const rowRe = /^(\d+)(?:-\d+)? ?\t(.+)\t([^\t]+)$/;
  let count = 0;
  for (const line of appendix1Text.split('\n')) {
    const m = line.match(rowRe);
    if (!m) continue;
    const rank = parseInt(m[1], 10);
    if (rank > RANK_CUTOFF) continue;
    const countryRu = m[3].trim();
    const country = RU_TO_EN[countryRu];
    if (!country) {
      console.warn(`  ! MosIU: unmapped country "${countryRu}"`);
      continue;
    }
    add(m[2].trim(), country);
    count++;
  }
  console.log(`  ✓ MosIU: ${count} universities`);
} catch (err) {
  console.error('  ✗ MosIU parse failed:', err.message);
}

// ── Write output ─────────────────────────────────────────────────────────────
const result = Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name));
const outPath = join(root, 'data', 'moe-universities.json');
writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`\nWrote ${result.length} universities to data/moe-universities.json`);
