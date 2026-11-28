/**
 * /admin logic against a local D1 with the demo seed: record forms in three
 * languages, the publish rule, Last checked on save, delete protection, the
 * audit log, the queues, and the upload checks.
 * Seed facts: university 1 and program 101 are published.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTranslations } from '../../src/i18n/index.ts';
import { ensureProfile } from '../../src/lib/account.ts';
import { diffOf, listAudit } from '../../src/lib/admin/audit.ts';
import { isStale, lastCheckedOnSave, slugify, staleBefore } from '../../src/lib/admin/form.ts';
import { isAdmin } from '../../src/lib/admin/roles.ts';
import { checkImage, fitWithin, webpSize } from '../../src/lib/admin/images.ts';
import {
  closeMistake,
  decideBadge,
  decidePost,
  grantTeamBadge,
  openMistakes,
  pendingBadges,
  queueCounts,
  reportedPosts,
} from '../../src/lib/admin/queues.ts';
import { RECORD_TYPES } from '../../src/lib/admin/types/index.ts';
import { parseOtherTests } from '../../src/lib/admin/types/programs.ts';
import {
  mistakeReports,
  programs,
  threads,
  trackerItems,
  translations,
  universities,
  user,
  userBadges,
} from '../../src/lib/db/schema.ts';
import { createThread, reportPost, requestBadge } from '../../src/lib/discussions.ts';
import { createTestDb, TODAY, type TestDb } from './db/test-db.ts';

const t = getTranslations('en');
let db: TestDb;
const ADMIN = 'admin-1';

async function newUser(id: string): Promise<string> {
  await db.db.insert(user).values({ id, name: '', email: `${id}@mail.test`, emailVerified: true });
  await ensureProfile(db.db, id, 'en');
  return id;
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(name, v);
  }
  return data;
}

/** A WebP (lossless) header of the given size, enough for webpSize. */
function webp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  bytes.set(
    [...'WEBPVP8L'].map((c) => c.charCodeAt(0)),
    8,
  );
  bytes[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  bytes.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff], 21);
  return bytes;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.db.insert(user).values({ id: ADMIN, name: '', email: 'admin@mail.test', role: 'admin' });
}, 60_000);
afterAll(async () => {
  await db?.dispose();
});

describe('helpers', () => {
  it('knows admins by role', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ user: { id: 'x', role: 'student' } } as never)).toBe(false);
    expect(isAdmin({ user: { id: 'x', role: 'admin' } } as never)).toBe(true);
  });

  it('flags records not checked for 12 months', () => {
    expect(staleBefore('2026-12-01')).toBe('2025-12-01');
    expect(isStale('2025-11-30', '2026-12-01')).toBe(true);
    expect(isStale('2025-12-01', '2026-12-01')).toBe(false);
  });

  it('sets Last checked to today unless the admin changed it', () => {
    expect(
      lastCheckedOnSave(
        form({ last_checked: '2025-01-01', last_checked_was: '2025-01-01' }),
        TODAY,
      ),
    ).toBe(TODAY);
    expect(
      lastCheckedOnSave(
        form({ last_checked: '2025-02-02', last_checked_was: '2025-01-01' }),
        TODAY,
      ),
    ).toBe('2025-02-02');
  });

  it('makes slugs and reads other tests', () => {
    expect(slugify('Üniversite of Ankara (Türkiye)')).toBe('universite-of-ankara-turkiye');
    expect(parseOtherTests('SAT: 1200\nGRE')).toEqual([
      { name: 'SAT', min: '1200' },
      { name: 'GRE', min: null },
    ]);
    expect(diffOf({ a: 1, b: 'x' }, { a: 1, b: 'y', c: true })).toEqual({
      b: ['x', 'y'],
      c: [null, true],
    });
  });
});

describe('uploads', () => {
  it('accepts WebP logos up to 128 px and photos up to 1200 px', () => {
    expect(webpSize(webp(128, 96))).toEqual({ width: 128, height: 96 });
    expect(checkImage('logo', webp(128, 128))).toEqual({ ok: true, width: 128, height: 128 });
    expect(checkImage('logo', webp(129, 10))).toEqual({ ok: false, reason: 'dimensions' });
    expect(checkImage('photo', webp(1200, 675)).ok).toBe(true);
  });

  it('refuses anything that is not a WebP', () => {
    const png = new Uint8Array(40);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    expect(checkImage('photo', png)).toEqual({ ok: false, reason: 'type' });
    expect(checkImage('logo', new Uint8Array(0))).toEqual({ ok: false, reason: 'size' });
  });

  it('shrinks to fit, never enlarges', () => {
    expect(fitWithin(2400, 1600, 1200)).toEqual({ width: 1200, height: 800 });
    expect(fitWithin(64, 32, 128)).toEqual({ width: 64, height: 32 });
  });
});

describe('record forms', () => {
  const programs_ = RECORD_TYPES.programs;
  const base = {
    name_en: 'Admin Test Program',
    name_tk: 'Synag maksatnamasy',
    name_ru: '',
    slug: '',
    provider: 'university:1',
    level: 'bachelor',
    field: 'computing',
    language_of_study: 'en',
    duration_years: '4',
    tuition_per_year_usd: '',
    intakes: ['9', '2'],
    pre_year_required: 'yes',
    ielts_min: '6.5',
    other_tests: 'SAT: 1200',
    documents: ['passport', 'not-a-document'],
    source_url: '',
    last_checked: '2024-01-01',
    last_checked_was: '2024-01-01',
  };

  it('needs a source to publish', () => {
    const parsed = programs_.parse(form({ ...base, published: 'on' }), TODAY);
    expect(parsed.errors['source_url']?.key).toBe('admin.error.publishNeedsSource');
  });

  it('saves a program with its translation, Last checked today and an audit row', async () => {
    const parsed = programs_.parse(
      form({ ...base, source_url: 'https://example.org/p', published: 'on' }),
      TODAY,
    );
    expect(parsed.errors).toEqual({});
    const saved = await parsed.save(db.db, ADMIN, null, null);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const [row] = await db.db.select().from(programs).where(eq(programs.id, saved.id));
    expect(row).toMatchObject({
      slug: 'admin-test-program',
      tuitionPerYearUsd: null,
      intakes: [2, 9],
      lastChecked: TODAY,
      published: true,
      requirements: {
        ieltsMin: 6.5,
        otherTests: [{ name: 'SAT', min: '1200' }],
        documents: ['passport'],
      },
    });
    const texts = await db.db
      .select({ lang: translations.lang, text: translations.text })
      .from(translations)
      .where(eq(translations.entityId, String(saved.id)));
    expect(texts).toEqual([{ lang: 'tk', text: 'Synag maksatnamasy' }]);

    const loaded = await programs_.load(db.db, saved.id);
    expect(loaded?.['name']).toEqual({
      en: 'Admin Test Program',
      tk: 'Synag maksatnamasy',
      ru: '',
    });
    expect(programs_.publicPath(loaded ?? {}, 'ru')).toBe('/ru/programs/admin-test-program');

    const audit = await listAudit(db.db, { entityType: 'program', entityId: String(saved.id) });
    expect(audit[0]).toMatchObject({ action: 'create', adminId: ADMIN });
  });

  it('refuses a taken slug and a bad pathway, with form errors', async () => {
    const parsed = programs_.parse(form({ ...base, slug: 'admin-test-program' }), TODAY);
    const saved = await parsed.save(db.db, ADMIN, null, null);
    expect(saved).toEqual({ ok: false, errors: { slug: { key: 'admin.error.slugTaken' } } });

    const pathway = RECORD_TYPES.pathways.parse(
      form({ from_program_id: '101', to_program_id: '101' }),
      TODAY,
    );
    const bad = await pathway.save(db.db, ADMIN, null, null);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.values(bad.errors)[0]?.key).toBe('admin.error.pathwayLevels');
  });

  it('edits a university: the Ministry status needs a basis, and translations can be removed', async () => {
    const unis = RECORD_TYPES.universities;
    const before = await unis.load(db.db, 1);
    expect(before).not.toBeNull();
    const fields = {
      name_en: 'Demo University 1',
      name_tk: '',
      name_ru: 'Демо-университет 1',
      slug: String(before?.['slug']),
      country_code: String(before?.['country_code']),
      city: 'Edited City',
      ministry_status: 'approved',
      ministry_basis: '',
      source_url: 'https://example.org/u1',
      last_checked: TODAY,
      last_checked_was: TODAY,
      published: 'on',
    };
    expect(unis.parse(form(fields), TODAY).errors['ministry_basis']?.key).toBe(
      'admin.error.basisNeeded',
    );
    const parsed = unis.parse(form({ ...fields, ministry_basis: 'QS 400' }), TODAY);
    expect(parsed.errors).toEqual({});
    expect((await parsed.save(db.db, ADMIN, 1, before)).ok).toBe(true);
    const [u] = await db.db.select().from(universities).where(eq(universities.id, 1));
    expect(u).toMatchObject({ city: 'Edited City', ministryBasis: 'QS 400' });
    const after = await unis.load(db.db, 1);
    expect(after?.['name']).toEqual({ en: 'Demo University 1', tk: '', ru: 'Демо-университет 1' });
    const [audit] = await listAudit(db.db, { entityType: 'university', entityId: '1' });
    expect(audit?.diff).toMatchObject({ city: [before?.['city'], 'Edited City'] });
  });

  it("won't delete a program a student tracks, but deletes others", async () => {
    const student = await newUser('tracker-student');
    await db.db.insert(trackerItems).values({ userId: student, programId: 101 });
    expect(await RECORD_TYPES.programs.remove(db.db, ADMIN, 101)).toEqual({
      ok: false,
      error: 'admin.error.inUse',
    });
    const [p] = await db.db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.slug, 'admin-test-program'));
    expect(await RECORD_TYPES.programs.remove(db.db, ADMIN, p?.id ?? 0)).toEqual({ ok: true });
  });

  it('lists records with search, draft and stale filters', async () => {
    const all = await RECORD_TYPES.universities.list(
      db.db,
      'en',
      { q: '', country: '', published: 'no', stale: false, status: '', level: '', page: 1 },
      TODAY,
    );
    expect(all.rows.length).toBeGreaterThan(0);
    expect(all.rows.every((r) => r.published === false)).toBe(true);
    const found = await RECORD_TYPES.scholarships.list(
      db.db,
      'en',
      {
        q: 'demo-scholarship-1',
        country: '',
        published: '',
        stale: false,
        status: '',
        level: '',
        page: 1,
      },
      TODAY,
    );
    expect(found.rows.map((r) => r.title)).toHaveLength(1);
  });
});

describe('queues', () => {
  it('resolves mistake reports', async () => {
    await db.db
      .insert(mistakeReports)
      .values({ entityType: 'program', entityId: '101', message: 'Wrong fee' });
    const open = await openMistakes(db.db, 'en');
    expect(open[0]).toMatchObject({ message: 'Wrong fee', adminPath: '/admin/programs/101' });
    expect(await closeMistake(db.db, ADMIN, open[0]?.id ?? 0, 'resolved')).toBe(true);
    expect(await openMistakes(db.db, 'en')).toEqual([]);
  });

  it('keeps a post an admin restored visible until three new reports', async () => {
    const author = await newUser('author');
    const created = await createThread(db.db, author, {
      topic: 'scholarships',
      title: 'Reported question about visas',
      body: 'Body text that is long enough.',
      postLang: 'en',
      universityId: null,
      programId: null,
    });
    if (!created.ok) throw new Error(created.error);
    const id = created.id;
    for (const r of ['r1', 'r2', 'r3']) {
      await newUser(r);
      await reportPost(db.db, r, { targetType: 'thread', targetId: id, reason: 'spam' });
    }
    const [hidden] = await db.db
      .select({ status: threads.status })
      .from(threads)
      .where(eq(threads.id, id));
    expect(hidden?.status).toBe('hidden');
    const queue = await reportedPosts(db.db, 'en', t);
    expect(queue.find((p) => p.targetId === id)).toMatchObject({ hidden: true, reports: 3 });
    expect((await queueCounts(db.db)).posts).toBeGreaterThan(0);

    await decidePost(db.db, ADMIN, 'thread', id, 'restore');
    await newUser('r4');
    await reportPost(db.db, 'r4', { targetType: 'thread', targetId: id, reason: 'spam' });
    const [open] = await db.db
      .select({ status: threads.status })
      .from(threads)
      .where(eq(threads.id, id));
    expect(open?.status).toBe('open');

    await decidePost(db.db, ADMIN, 'thread', id, 'delete');
    expect(await db.db.select().from(threads).where(eq(threads.id, id))).toEqual([]);
  });

  it('approves "Studies here" requests and gives the team badge by email', async () => {
    const student = await newUser('badge-student');
    const asked = await requestBadge(db.db, student, { universityId: 1, note: 'Year 2' });
    expect(asked).toBe('ok');
    const [pending] = await pendingBadges(db.db, t);
    expect(pending).toMatchObject({ userId: student, note: 'Year 2' });
    await decideBadge(db.db, ADMIN, pending?.id ?? 0, 'approve');
    const [badge] = await db.db.select().from(userBadges).where(eq(userBadges.userId, student));
    expect(badge?.verifiedBy).toBe(ADMIN);

    expect(await grantTeamBadge(db.db, ADMIN, 'nobody@mail.test')).toBe('noUser');
    expect(await grantTeamBadge(db.db, ADMIN, 'Badge-Student@mail.test')).toBe('ok');
    expect(await grantTeamBadge(db.db, ADMIN, 'badge-student@mail.test')).toBe('already');
  });
});
