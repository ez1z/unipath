import { getAll as getAllUniversities } from '@/lib/data/universities';
import { getAll as getAllScholarships } from '@/lib/data/scholarships';
import type { Locale } from '@/lib/constants';

const MAX_MAJORS = 5;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// How many records to inject per request. The catalog has ~1000 universities;
// sending them all blows the free LLM provider's per-minute token limit, so we
// retrieve only the records relevant to the user's question.
const MAX_UNIS = 25;
const MAX_SCHOLARSHIPS = 12;

function tuitionText(min: number, max: number | null): string {
  if (max != null && max > min) return `$${min}-${max}`;
  return `$${min}`;
}

function amountText(min: number | null, max: number | null): string {
  if (min == null) return 'amount n/a';
  if (max != null && max > min) return `$${min}-${max}`;
  return `$${min}`;
}

type UniIndexed = {
  line: string; // compact display string
  slug: string; // for the UniPath detail-page link
  haystack: string; // lowercase searchable blob
  country: string; // lowercase
  tuition: number;
  ranking: number | null;
  moe: boolean;
};

type SchIndexed = {
  line: string;
  slug: string;
  haystack: string;
  country: string;
};

type Snapshot = {
  unis: UniIndexed[];
  scholarships: SchIndexed[];
  countries: string[];
  uniCount: number;
  schCount: number;
};

/** Loads and indexes the catalog into a compact, searchable in-memory snapshot. */
async function load(): Promise<Snapshot> {
  const [universities, scholarships] = await Promise.all([
    getAllUniversities(),
    getAllScholarships(),
  ]);

  const unis: UniIndexed[] = universities.map((u) => {
    const majors = u.majors.slice(0, MAX_MAJORS).join(', ');
    const line = [
      u.name.en,
      `${u.city}, ${u.country}`,
      tuitionText(u.tuition_usd, u.tuition_usd_max),
      u.moe_approved ? 'MoE-approved' : 'not MoE-approved',
      u.ranking_qs ? `QS #${u.ranking_qs}` : null,
      u.languages.length ? `langs: ${u.languages.join('/')}` : null,
      majors ? `majors: ${majors}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const haystack = [
      u.name.en,
      u.name.ru,
      u.name.tk,
      u.country,
      u.city,
      u.languages.join(' '),
      u.majors.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return {
      line,
      slug: u.slug,
      haystack,
      country: u.country.toLowerCase(),
      tuition: u.tuition_usd,
      ranking: u.ranking_qs,
      moe: u.moe_approved,
    };
  });

  const scholarshipsIdx: SchIndexed[] = scholarships.map((s) => {
    const line = [
      s.name.en,
      s.country,
      s.type,
      amountText(s.amount_usd, s.amount_usd_max),
      s.coverage.length ? `covers: ${s.coverage.join('/')}` : null,
      s.deadline_text ? `deadline: ${s.deadline_text}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const haystack = [s.name.en, s.name.ru, s.name.tk, s.country, s.type, s.coverage.join(' ')]
      .join(' ')
      .toLowerCase();

    return { line, slug: s.slug, haystack, country: s.country.toLowerCase() };
  });

  const countries = [...new Set(universities.map((u) => u.country))].sort();

  return {
    unis,
    scholarships: scholarshipsIdx,
    countries,
    uniCount: universities.length,
    schCount: scholarships.length,
  };
}

// Module-level cache. We can't use `unstable_cache` here because the underlying
// Supabase server client reads cookies(), which Next.js forbids inside it. A
// plain TTL cache avoids re-querying on every message. Refreshes after an hour.
let cached: { snapshot: Snapshot; at: number } | null = null;

async function getSnapshot(): Promise<Snapshot> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot;
  const snapshot = await load();
  cached = { snapshot, at: Date.now() };
  return snapshot;
}

const CHEAP_RE = /cheap|afford|budget|inexpensive|lowest|under \$?\d|less than|ucuz|arzan|дешев|недорог|дешёв/i;
const TOP_RE = /\btop\b|best|highest|prestig|ranking|ranked|лучш|рейтинг|престиж|iň gowy|abraý/i;
const MOE_RE = /\bmoe\b|approv|transfer|eligible|tassyk|одобрен|перевод/i;

/**
 * Builds a small, query-relevant grounding context. Filters the catalog to the
 * universities/scholarships that match the user's latest message (by country,
 * name, city, major, language), applies cheap/top/MoE intent hints, and caps the
 * result so the request stays well under the LLM's per-minute token limit.
 */
export async function buildGroundingContext(query: string, locale: Locale): Promise<string> {
  const snap = await getSnapshot();
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9а-яё]+/i).filter((w) => w.length >= 3);

  // ── Universities ──────────────────────────────────────────────────────────
  let unis = snap.unis;

  const mentionedCountries = snap.countries
    .map((c) => c.toLowerCase())
    .filter((c) => q.includes(c));
  if (mentionedCountries.length) {
    const set = new Set(mentionedCountries);
    const filtered = unis.filter((u) => set.has(u.country));
    if (filtered.length) unis = filtered;
  }

  if (MOE_RE.test(q)) {
    const moe = unis.filter((u) => u.moe);
    if (moe.length) unis = moe;
  }

  // Keyword relevance scoring (name / city / major / language).
  if (words.length) {
    const scored = unis
      .map((u) => ({ u, score: words.reduce((n, w) => n + (u.haystack.includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length) unis = scored.map((x) => x.u);
  }

  // Intent-based ordering for superlative queries that keywords can't capture.
  if (CHEAP_RE.test(q)) unis = [...unis].sort((a, b) => a.tuition - b.tuition);
  else if (TOP_RE.test(q)) unis = [...unis].sort((a, b) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity));

  const uniLines = unis
    .slice(0, MAX_UNIS)
    .map((u) => `${u.line} | UniPath page: /${locale}/universities/${u.slug}`);

  // ── Scholarships ──────────────────────────────────────────────────────────
  let sch = snap.scholarships;
  if (mentionedCountries.length) {
    const set = new Set(mentionedCountries);
    const filtered = sch.filter((s) => set.has(s.country));
    if (filtered.length) sch = filtered;
  }
  if (words.length) {
    const scored = sch
      .map((s) => ({ s, score: words.reduce((n, w) => n + (s.haystack.includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length) sch = scored.map((x) => x.s);
  }
  const schLines = sch
    .slice(0, MAX_SCHOLARSHIPS)
    .map((s) => `${s.line} | UniPath page: /${locale}/scholarships/${s.slug}`);

  return [
    `CATALOG OVERVIEW: ${snap.uniCount} universities total, across these countries: ${snap.countries.join(', ')}. ${snap.schCount} scholarships total.`,
    `Only the records most relevant to the user's question are listed below — the full catalog is larger. For broad browsing, point the user to the universities/scholarships pages.`,
    '',
    `RELEVANT UNIVERSITIES (${uniLines.length} of ${snap.uniCount}):`,
    uniLines.join('\n') || '(no specific matches — suggest the user browse the universities page or refine their question)',
    '',
    `RELEVANT SCHOLARSHIPS (${schLines.length} of ${snap.schCount}):`,
    schLines.join('\n') || '(no specific matches)',
  ].join('\n');
}
