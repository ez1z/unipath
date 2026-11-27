import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTestDb, type TestDb } from './test-db.ts';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

const run = (sql: string, ...params: unknown[]) =>
  t.d1
    .prepare(sql)
    .bind(...params)
    .run();

async function rows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await t.d1
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return result.results;
}

describe('migrations', () => {
  test('create every table in the data model', async () => {
    const tables = (
      await rows<{ name: string }>(
        `select name from sqlite_master where type = 'table'
         and name not like 'sqlite_%' and name not like '_cf_%' and name <> 'd1_migrations'
         order by name`,
      )
    ).map((r) => r.name);
    expect(tables).toEqual(
      [
        'countries',
        'universities',
        'pathway_colleges',
        'programs',
        'pathways',
        'scholarships',
        'scholarship_programs',
        'scholarship_universities',
        'translations',
        'user',
        'session',
        'account',
        'verification',
        'profiles',
        'saved_items',
        'tracker_items',
        'tracker_tasks',
        'share_links',
        'reminder_log',
        'topics',
        'threads',
        'replies',
        'reply_votes',
        'reports',
        'user_badges',
        'mistake_reports',
        'settings',
        'audit_log',
      ].sort(),
    );
  });

  test('programs have the columns from the spec, plus pre_year_required', async () => {
    const columns = (
      await rows<{ name: string }>(`select name from pragma_table_info('programs')`)
    ).map((c) => c.name);
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'provider_type',
        'university_id',
        'college_id',
        'level',
        'name',
        'field',
        'language_of_study',
        'duration_years',
        'tuition_per_year_usd',
        'intakes',
        'requirements',
        'application_deadline',
        'pre_year_required',
        'last_checked',
        'source_url',
        'published',
      ]),
    );
  });

  // SPEC.md "Indexes (at minimum)". An index (or primary key) must start with these columns.
  test.each([
    ['programs', ['level', 'university_id']],
    ['programs', ['field']],
    ['programs', ['published', 'level']],
    ['universities', ['country_code', 'ministry_status']],
    ['scholarships', ['deadline']],
    ['threads', ['topic_slug', 'last_activity_at']],
    ['saved_items', ['user_id']],
    ['tracker_items', ['user_id']],
  ])('%s is indexed on (%s)', async (table, wanted) => {
    const indexes = await rows<{ index_name: string; column: string; seqno: number }>(
      `select il.name as index_name, ii.name as column, ii.seqno as seqno
       from pragma_index_list(?) il join pragma_index_info(il.name) ii
       order by il.name, ii.seqno`,
      table,
    );
    const byIndex = new Map<string, string[]>();
    for (const r of indexes)
      byIndex.set(r.index_name, [...(byIndex.get(r.index_name) ?? []), r.column]);
    const covered = [...byIndex.values()].some((cols) =>
      wanted.every((column, i) => cols[i] === column),
    );
    expect(covered, `${table}(${wanted.join(', ')}) in ${JSON.stringify([...byIndex])}`).toBe(true);
  });
});

describe('constraints on programs', () => {
  const insertProgram = (fields: Record<string, unknown>) => {
    const row = {
      slug: `test-${Math.random().toString(36).slice(2)}`,
      provider_type: 'university',
      university_id: 1,
      college_id: null,
      level: 'bachelor',
      name: 'Test',
      field: 'business',
      language_of_study: 'en',
      duration_years: 4,
      pre_year_required: 'no',
      last_checked: '2026-12-01',
      source_url: 'https://example.com/demo/test',
      published: 1,
      ...fields,
    };
    const keys = Object.keys(row);
    return run(
      `insert into programs (${keys.join(', ')}) values (${keys.map(() => '?').join(', ')})`,
      ...Object.values(row),
    );
  };

  test('a valid bachelor’s and a valid college foundation year insert', async () => {
    await expect(insertProgram({})).resolves.toBeTruthy();
    await expect(
      insertProgram({
        provider_type: 'college',
        university_id: null,
        college_id: 1,
        level: 'foundation',
        pre_year_required: null,
      }),
    ).resolves.toBeTruthy();
  });

  test('exactly one of university_id and college_id', async () => {
    await expect(insertProgram({ college_id: 1 })).rejects.toThrow(/programs_provider/);
    await expect(insertProgram({ university_id: null })).rejects.toThrow(/programs_provider/);
    await expect(insertProgram({ provider_type: 'college' })).rejects.toThrow(/programs_provider/);
  });

  test('pre_year_required is set on bachelor’s and only there', async () => {
    await expect(insertProgram({ pre_year_required: null })).rejects.toThrow(
      /programs_pre_year_required/,
    );
    await expect(insertProgram({ pre_year_required: 'maybe' })).rejects.toThrow(
      /programs_pre_year_required/,
    );
    await expect(insertProgram({ level: 'language', pre_year_required: 'no' })).rejects.toThrow(
      /programs_pre_year_required/,
    );
  });

  test('enum columns only take known values', async () => {
    await expect(insertProgram({ level: 'master' })).rejects.toThrow(/CHECK/);
    await expect(insertProgram({ field: 'magic' })).rejects.toThrow(/programs_field/);
    await expect(
      run(`update universities set ministry_status = 'maybe' where id = 1`),
    ).rejects.toThrow(/universities_ministry_status/);
  });

  test('a record can only be published with a source_url', async () => {
    await expect(insertProgram({ source_url: null })).rejects.toThrow(/programs_published_source/);
    await expect(insertProgram({ source_url: null, published: 0 })).resolves.toBeTruthy();
  });

  test('foreign keys are enforced', async () => {
    await expect(insertProgram({ university_id: 9999 })).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('pathway rules in the database', () => {
  // Seed ids: 104 language, 203/602 foundation, 101/201 bachelor's.
  const insertPathway = (from: number, to: number) =>
    run(`insert into pathways (from_program_id, to_program_id) values (?, ?)`, from, to);

  test('pre-year → bachelor’s is allowed', async () => {
    await expect(insertPathway(203, 101)).resolves.toBeTruthy();
    await expect(insertPathway(104, 201)).resolves.toBeTruthy();
  });

  test('anything else is rejected', async () => {
    await expect(insertPathway(101, 201)).rejects.toThrow(/pathway_levels/); // bachelor → bachelor
    await expect(insertPathway(203, 104)).rejects.toThrow(/pathway_levels/); // foundation → language
    await expect(insertPathway(201, 203)).rejects.toThrow(/pathway_levels/); // bachelor → foundation
    await expect(insertPathway(203, 99999)).rejects.toThrow(/pathway_levels/); // missing program
  });

  test('an update can’t break the rule either', async () => {
    // Pathway 3 is 203 → 201.
    await expect(run(`update pathways set to_program_id = 602 where id = 3`)).rejects.toThrow(
      /pathway_levels/,
    );
    await expect(run(`update pathways set from_program_id = 101 where id = 3`)).rejects.toThrow(
      /pathway_levels/,
    );
    await expect(
      run(`update programs set level = 'bachelor', pre_year_required = 'no' where id = 203`),
    ).rejects.toThrow(/pathway_levels/);
    await expect(
      run(`update programs set level = 'language', pre_year_required = null where id = 201`),
    ).rejects.toThrow(/pathway_levels/);
  });

  test('the same pathway can’t be added twice', async () => {
    await expect(insertPathway(401, 402)).rejects.toThrow(/UNIQUE/);
  });
});

describe('deleting an account', () => {
  test('removes all of the user’s rows', async () => {
    const now = Date.now();
    await t.d1.batch(
      [
        [`insert into user (id, name, email) values ('u1', 'Test', 'test@example.com')`],
        [`insert into user (id, name, email) values ('u2', 'Other', 'other@example.com')`],
        [`insert into profiles (user_id, display_name) values ('u1', 'Tester')`],
        [
          `insert into session (id, expires_at, token, updated_at, user_id) values ('s1', ?, 't1', ?, 'u1')`,
          now,
          now,
        ],
        [
          `insert into account (id, account_id, provider_id, user_id, updated_at) values ('a1', 'x', 'email', 'u1', ?)`,
          now,
        ],
        [`insert into saved_items (user_id, item_type, item_id) values ('u1', 'program', 101)`],
        [`insert into tracker_items (id, user_id, program_id) values (1, 'u1', 101)`],
        [`insert into tracker_tasks (item_id, title) values (1, 'Passport')`],
        [
          `insert into share_links (token, user_id, scope, expires_at) values ('tok', 'u1', 'tracker', ?)`,
          now,
        ],
        [`insert into reminder_log (tracker_item_id, days_before, sent_at) values (1, 30, ?)`, now],
        [
          `insert into threads (id, topic_slug, title, body, author_id, lang) values (1, 'tests', 'Q', 'B', 'u1', 'en')`,
        ],
        [
          `insert into threads (id, topic_slug, title, body, author_id, lang) values (2, 'tests', 'Q2', 'B', 'u2', 'en')`,
        ],
        [`insert into replies (id, thread_id, author_id, body) values (1, 2, 'u1', 'Answer')`],
        [`insert into reply_votes (user_id, reply_id) values ('u1', 1)`],
        [
          `insert into reports (target_type, target_id, reporter_id, reason) values ('thread', 2, 'u1', 'spam')`,
        ],
        [`insert into user_badges (user_id, type, university_id) values ('u1', 'studies_here', 1)`],
      ].map(([sql, ...params]) => t.d1.prepare(sql as string).bind(...params)),
    );
    await run(`update threads set helped_reply_id = 1 where id = 2`);

    await run(`delete from user where id = 'u1'`);

    const left = await rows<Record<string, number>>(
      `select
        (select count(*) from profiles where user_id = 'u1') profiles,
        (select count(*) from session where user_id = 'u1') sessions,
        (select count(*) from account where user_id = 'u1') accounts,
        (select count(*) from saved_items where user_id = 'u1') saved,
        (select count(*) from tracker_items where user_id = 'u1') tracker,
        (select count(*) from tracker_tasks) tasks,
        (select count(*) from share_links where user_id = 'u1') shares,
        (select count(*) from reminder_log) reminders,
        (select count(*) from threads where author_id = 'u1') threads,
        (select count(*) from replies where author_id = 'u1') replies,
        (select count(*) from reply_votes where user_id = 'u1') votes,
        (select count(*) from reports where reporter_id = 'u1') reports,
        (select count(*) from user_badges where user_id = 'u1') badges`,
    );
    expect(
      Object.values(left[0] ?? {}).every((n) => n === 0),
      JSON.stringify(left[0]),
    ).toBe(true);

    // Other users' posts stay; the deleted reply is no longer the "Helped me" answer.
    const [other] = await rows<{ helped_reply_id: number | null }>(
      `select helped_reply_id from threads where id = 2`,
    );
    expect(other).toEqual({ helped_reply_id: null });
  });
});
