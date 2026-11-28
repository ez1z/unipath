/**
 * Tracker, share links and deadline reminders against a local D1 with the demo
 * seed. Seed facts used here (scripts/seed-data.ts, today = TODAY):
 * - program 101: bachelor's, IELTS 6, the basic documents, deadline in 60 days.
 * - pathway 1: language year 104 (no deadline) → Medicine 103, 1 + 6 years.
 * - pathway 3: foundation 203 (deadline in 40 days) → bachelor's 201.
 * - program 105 and scholarship 5 are unpublished; scholarship 3 is rolling.
 */
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTranslations } from '../../src/i18n/index.ts';
import {
  ensureProfile,
  parsePendingAction,
  serializePendingAction,
  updateProfile,
} from '../../src/lib/account.ts';
import { addDays } from '../../src/lib/dates.ts';
import { account, reminderLog, trackerItems, user } from '../../src/lib/db/schema.ts';
import type { Mail, Mailer } from '../../src/lib/email.ts';
import { dueReminder, runReminders } from '../../src/lib/reminders.ts';
import {
  addTask,
  createShareLink,
  deleteItem,
  deleteTask,
  getSharedView,
  getTrackerItem,
  listShareLinks,
  listTracker,
  nextDeadline,
  revokeShareLink,
  setDeadline,
  setNotes,
  setStage,
  setTaskDone,
  taskLabel,
  trackTarget,
} from '../../src/lib/tracker.ts';
import { createTestDb, TODAY, type TestDb } from './db/test-db.ts';

let t: TestDb;
let n = 0;

async function newUser(email?: string): Promise<string> {
  const id = `user-${++n}`;
  await t.db.insert(user).values({
    id,
    name: '',
    email: email ?? `${id}@mail.test`,
    emailVerified: true,
  });
  await ensureProfile(t.db, id, 'en');
  return id;
}

async function track(userId: string, type: 'program' | 'pathway' | 'scholarship', id: number) {
  const result = await trackTarget(t.db, userId, { type, id });
  if (!result.ok) throw new Error(`track failed: ${result.error}`);
  return result.id;
}

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.dispose();
});

describe('Track this', () => {
  it('tracks a program in Planning with tasks from its requirements, once', async () => {
    const me = await newUser();
    const first = await trackTarget(t.db, me, { type: 'program', id: 101 });
    expect(first).toMatchObject({ ok: true, created: true });
    const again = await trackTarget(t.db, me, { type: 'program', id: 101 });
    expect(again).toMatchObject({ ok: true, created: false });
    expect(again.ok && first.ok && again.id === first.id).toBe(true);

    const found = await getTrackerItem(t.db, me, first.ok ? first.id : 0, 'en');
    expect(found?.item).toMatchObject({
      type: 'program',
      stage: 'planning',
      deadline: addDays(TODAY, 60),
      deadlineOverridden: false,
      done: 0,
      path: '/programs/demo-u1-business-administration',
    });
    const codes = found?.tasks.map((task) => task.code) ?? [];
    expect(codes[0]).toBe('ielts:6');
    expect(codes).toContain('doc:passport');
    expect(codes.at(-1)).toBe('apply:program');
    expect(found?.item.total).toBe(codes.length);
  });

  it('two taps at once still make one item', async () => {
    const me = await newUser();
    const [a, b] = await Promise.all([
      trackTarget(t.db, me, { type: 'scholarship', id: 1 }),
      trackTarget(t.db, me, { type: 'scholarship', id: 1 }),
    ]);
    expect(a.ok && b.ok && a.id === b.id).toBe(true);
    expect(await listTracker(t.db, me, 'en')).toHaveLength(1);
  });

  it('tracks a pathway as one item with two steps and the total years', async () => {
    const me = await newUser();
    const id = await track(me, 'pathway', 1);
    const found = await getTrackerItem(t.db, me, id, 'en');
    expect(found?.item.type).toBe('pathway');
    expect(found?.item.steps.map((s) => s.level)).toEqual(['language', 'bachelor']);
    expect(found?.item.totalYears).toBe(7);
    // The language year has no confirmed deadline, so neither has the path.
    expect(found?.item.deadline).toBeNull();
    expect(found?.tasks.map((task) => task.code)).toEqual([
      'doc:passport',
      'doc:school_certificate',
      'doc:photos',
      'apply:pre-year',
      'progress:bachelor',
    ]);

    const other = await getTrackerItem(t.db, me, await track(me, 'pathway', 3), 'en');
    expect(other?.item.deadline).toBe(addDays(TODAY, 40));
  });

  it('tracks a scholarship; a rolling one has no deadline', async () => {
    const me = await newUser();
    const one = await getTrackerItem(t.db, me, await track(me, 'scholarship', 1), 'en');
    expect(one?.item).toMatchObject({ type: 'scholarship', deadline: addDays(TODAY, 45) });
    expect(one?.tasks.map((task) => task.code)).toEqual(['eligibility', 'apply:scholarship']);
    const rolling = await getTrackerItem(t.db, me, await track(me, 'scholarship', 3), 'en');
    expect(rolling?.item).toMatchObject({ deadline: null, rolling: true });
  });

  it('refuses unpublished or unknown records', async () => {
    const me = await newUser();
    for (const [type, id] of [
      ['program', 105],
      ['scholarship', 5],
      ['pathway', 9999],
      ['program', 9999],
    ] as const) {
      expect(await trackTarget(t.db, me, { type, id })).toEqual({ ok: false, error: 'notFound' });
    }
    expect(await listTracker(t.db, me, 'en')).toEqual([]);
  });

  it('round-trips Track as the pending action of sign-in', () => {
    const action = { kind: 'track', target: { type: 'pathway', id: 3 } } as const;
    expect(serializePendingAction(action)).toBe('track:pathway:3');
    expect(parsePendingAction('track:pathway:3')).toEqual(action);
    expect(parsePendingAction('track:university:3')).toBeNull();
    expect(parsePendingAction('track:program:3:x')).toBeNull();
  });
});

describe('changing an item', () => {
  it('changes stage, ticks tasks, adds and removes tasks, notes and deadline', async () => {
    const me = await newUser();
    const id = await track(me, 'program', 101);
    const before = await getTrackerItem(t.db, me, id, 'en');
    const [firstTask, secondTask] = before?.tasks ?? [];

    expect(await setStage(t.db, me, id, 'preparing')).toBe(true);
    expect(await setTaskDone(t.db, me, id, firstTask?.id ?? 0, true)).toBe(true);
    expect(await setTaskDone(t.db, me, id, secondTask?.id ?? 0, true)).toBe(true);
    expect(await addTask(t.db, me, id, 'Translate the certificate')).toBe('ok');
    expect(await setNotes(t.db, me, id, 'Ask the school for a stamp')).toBe(true);
    expect(await setDeadline(t.db, me, id, addDays(TODAY, 10))).toBe(true);

    const after = await getTrackerItem(t.db, me, id, 'en');
    expect(after?.item).toMatchObject({
      stage: 'preparing',
      done: 2,
      total: (before?.item.total ?? 0) + 1,
      notes: 'Ask the school for a stamp',
      deadline: addDays(TODAY, 10),
      sourceDeadline: addDays(TODAY, 60),
      deadlineOverridden: true,
    });
    const added = after?.tasks.at(-1);
    expect(added).toMatchObject({ code: null, title: 'Translate the certificate', done: false });

    expect(await deleteTask(t.db, me, id, added?.id ?? 0)).toBe(true);
    expect(await setDeadline(t.db, me, id, null)).toBe(true);
    const reset = await getTrackerItem(t.db, me, id, 'en');
    expect(reset?.item).toMatchObject({ deadline: addDays(TODAY, 60), deadlineOverridden: false });
    expect(reset?.item.total).toBe(before?.item.total);
  });

  it("never reads or changes another student's item", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const id = await track(owner, 'program', 101);
    const task = (await getTrackerItem(t.db, owner, id, 'en'))?.tasks[0];

    expect(await getTrackerItem(t.db, stranger, id, 'en')).toBeNull();
    expect(await setStage(t.db, stranger, id, 'enrolled')).toBe(false);
    expect(await setNotes(t.db, stranger, id, 'x')).toBe(false);
    expect(await setDeadline(t.db, stranger, id, TODAY)).toBe(false);
    expect(await setTaskDone(t.db, stranger, id, task?.id ?? 0, true)).toBe(false);
    expect(await addTask(t.db, stranger, id, 'x')).toBe('notFound');
    expect(await deleteTask(t.db, stranger, id, task?.id ?? 0)).toBe(false);
    expect(await deleteItem(t.db, stranger, id)).toBe(false);
    expect(
      await createShareLink(t.db, stranger, { scope: 'item', itemId: id, lang: 'en' }),
    ).toEqual({
      ok: false,
      error: 'notFound',
    });
    // A task id from another item of the owner can't be ticked through this item.
    const otherItem = await track(owner, 'scholarship', 1);
    expect(await setTaskDone(t.db, owner, otherItem, task?.id ?? 0, true)).toBe(false);

    const intact = await getTrackerItem(t.db, owner, id, 'en');
    expect(intact?.item).toMatchObject({ stage: 'planning', notes: null, done: 0 });
  });

  it('stopping removes the item and its tasks', async () => {
    const me = await newUser();
    const id = await track(me, 'scholarship', 2);
    expect(await deleteItem(t.db, me, id)).toBe(true);
    expect(await getTrackerItem(t.db, me, id, 'en')).toBeNull();
    const tasks = await t.d1
      .prepare('select count(*) as n from tracker_tasks where item_id = ?')
      .bind(id)
      .first<{ n: number }>();
    expect(tasks?.n).toBe(0);
  });

  it('the next deadline is the nearest open one from today on', async () => {
    const me = await newUser();
    const soon = await track(me, 'scholarship', 2); // 20 days
    await track(me, 'program', 101); // 60 days
    await track(me, 'scholarship', 4); // closed 5 days ago
    let items = await listTracker(t.db, me, 'en');
    expect(nextDeadline(items, TODAY)?.id).toBe(soon);
    await setStage(t.db, me, soon, 'submitted');
    items = await listTracker(t.db, me, 'en');
    expect(nextDeadline(items, TODAY)?.deadline).toBe(addDays(TODAY, 60));
  });
});

describe('task labels', () => {
  it('shows pre-filled tasks in the reader language and own tasks as written', () => {
    const en = getTranslations('en');
    const ru = getTranslations('ru');
    expect(taskLabel(en, 'en', { code: 'ielts:6.5', title: '' })).toBe('Get IELTS 6.5 or higher');
    expect(taskLabel(ru, 'ru', { code: 'ielts:6.5', title: '' })).toBe(
      'Получить IELTS 6,5 или выше',
    );
    expect(taskLabel(en, 'en', { code: 'doc:passport', title: '' })).toBe('Passport');
    expect(taskLabel(en, 'en', { code: 'test:SAT:1200', title: '' })).toBe(
      'Get SAT 1200 or higher',
    );
    expect(taskLabel(en, 'en', { code: 'test:SAT:', title: '' })).toBe('Take the SAT');
    expect(taskLabel(en, 'en', { code: 'doc:unknown', title: 'kept' })).toBe('kept');
    expect(taskLabel(en, 'en', { code: null, title: 'My own' })).toBe('My own');
  });
});

describe('share with parents', () => {
  it('shows stages and checklists, never notes, until revoked', async () => {
    const me = await newUser();
    await updateProfile(t.db, me, { displayName: 'Aman' });
    const id = await track(me, 'program', 101);
    await track(me, 'scholarship', 1);
    await setNotes(t.db, me, id, 'private');
    const link = await createShareLink(t.db, me, { scope: 'tracker', lang: 'ru' });
    if (!link.ok) throw new Error('no link');
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const view = await getSharedView(t.db, link.token, 'ru');
    expect(view).toMatchObject({ lang: 'ru', nickname: 'Aman', scope: 'tracker' });
    expect(view?.items).toHaveLength(2);
    expect(view?.items.every(({ item }) => item.notes === null)).toBe(true);
    expect(view?.items[0]?.tasks.length).toBeGreaterThan(0);

    expect(await revokeShareLink(t.db, 'someone-else', link.token)).toBe(false);
    expect(await revokeShareLink(t.db, me, link.token)).toBe(true);
    expect(await getSharedView(t.db, link.token, 'ru')).toBeNull();
  });

  it('a one-item link shows only that item, and expires after 90 days', async () => {
    const me = await newUser();
    const id = await track(me, 'program', 101);
    await track(me, 'scholarship', 1);
    const now = new Date();
    const link = await createShareLink(t.db, me, { scope: 'item', itemId: id, lang: 'en' }, now);
    if (!link.ok) throw new Error('no link');
    const view = await getSharedView(t.db, link.token, 'en', now);
    expect(view?.items.map(({ item }) => item.id)).toEqual([id]);

    const later = new Date(now.getTime() + 91 * 86_400_000);
    expect(await getSharedView(t.db, link.token, 'en', later)).toBeNull();
    expect(await listShareLinks(t.db, me, later)).toEqual([]);
    expect(await getSharedView(t.db, 'x'.repeat(43), 'en')).toBeNull();
  });
});

describe('deadline reminders', () => {
  const mails: Mail[] = [];
  let failNext = false;
  const mailer: Mailer = {
    async send(mail) {
      if (failNext) {
        failNext = false;
        throw new Error('mail down');
      }
      mails.push(mail);
    },
  };
  const run = (today: string) =>
    runReminders({ db: t.db, mailer, siteUrl: 'https://clavis.test', today });

  beforeEach(async () => {
    mails.length = 0;
    failNext = false;
    // Only this block's items should be due: move every earlier item past the window.
    await t.db.update(trackerItems).set({ stage: 'submitted' });
  });

  it('marks are due within two days below 30, 7 and 1', () => {
    expect([31, 30, 28, 27, 8, 7, 5, 4, 2, 1, 0, -1].map(dueReminder)).toEqual([
      null,
      30,
      30,
      null,
      null,
      7,
      7,
      null,
      null,
      1,
      1,
      null,
    ]);
  });

  it('sends each reminder once, by email, in the student language', async () => {
    const me = await newUser('student@mail.test');
    await updateProfile(t.db, me, { reminderChannel: 'email', preferredLang: 'ru' });
    const id = await track(me, 'program', 101);
    await setDeadline(t.db, me, id, addDays(TODAY, 30));

    expect(await run(TODAY)).toMatchObject({ sent: 1, failed: 0 });
    expect(mails[0]).toMatchObject({ kind: 'reminder', to: 'student@mail.test' });
    expect(mails[0]?.subject).toContain('Осталось 30 дней');
    expect(mails[0]?.text).toContain(`https://clavis.test/ru/my/tracker/${id}`);
    expect(mails[0]?.text).toContain('https://clavis.test/ru/my/profile');

    // The same day again, and the next day (29 days left): nothing more.
    expect(await run(TODAY)).toMatchObject({ sent: 0 });
    expect(await run(addDays(TODAY, 1))).toMatchObject({ sent: 0 });
    // 7 days before, then 1 day before: one each.
    expect(await run(addDays(TODAY, 23))).toMatchObject({ sent: 1 });
    expect(await run(addDays(TODAY, 24))).toMatchObject({ sent: 0 });
    expect(await run(addDays(TODAY, 29))).toMatchObject({ sent: 1 });
    expect(await run(addDays(TODAY, 30))).toMatchObject({ sent: 0 });
    expect(mails.map((m) => m.subject.split(':')[0])).toEqual([
      'Осталось 30 дней',
      'Осталось 7 дней',
      'Остался 1 день',
    ]);
    const logged = await t.db.select().from(reminderLog).where(eq(reminderLog.trackerItemId, id));
    expect(logged.map((r) => r.daysBefore).sort((a, b) => a - b)).toEqual([1, 7, 30]);
  });

  it('a missed day is caught up, and a failed send is tried again', async () => {
    const me = await newUser();
    await updateProfile(t.db, me, { reminderChannel: 'email' });
    const id = await track(me, 'program', 101);
    await setDeadline(t.db, me, id, addDays(TODAY, 6));
    failNext = true;
    expect(await run(TODAY)).toMatchObject({ sent: 0, failed: 1 });
    expect(await run(addDays(TODAY, 1))).toMatchObject({ sent: 1 });
    expect(mails[0]?.subject).toContain('5 days left');
  });

  it('skips students with no channel, placeholder emails, Telegram without the bot, and sent items', async () => {
    const none = await newUser();
    const telegramOnly = await newUser('tg-42@telegram.invalid');
    const telegramChannel = await newUser();
    const submitted = await newUser();
    await updateProfile(t.db, telegramOnly, { reminderChannel: 'email' });
    await updateProfile(t.db, telegramChannel, { reminderChannel: 'telegram' });
    await updateProfile(t.db, submitted, { reminderChannel: 'email' });
    await t.db.insert(account).values({
      id: 'acc-tg',
      accountId: '42',
      providerId: 'telegram',
      userId: telegramChannel,
      updatedAt: new Date(),
    });
    const ids: number[] = [];
    for (const who of [none, telegramOnly, telegramChannel, submitted]) {
      const id = await track(who, 'program', 101);
      ids.push(id);
      await setDeadline(t.db, who, id, addDays(TODAY, 7));
      if (who === submitted) await setStage(t.db, who, id, 'submitted');
    }
    const result = await run(TODAY);
    expect(result.sent).toBe(0);
    expect(mails).toEqual([]);
    // Nothing was logged, so Telegram reminders go out once the bot is set up.
    expect(
      await t.db.select().from(reminderLog).where(inArray(reminderLog.trackerItemId, ids)),
    ).toEqual([]);

    const sent: string[] = [];
    const withBot = await runReminders({
      db: t.db,
      mailer,
      siteUrl: 'https://clavis.test',
      today: TODAY,
      telegram: async (chatId, text) => {
        sent.push(`${chatId}:${text.split('\n')[0]}`);
      },
    });
    expect(withBot.sent).toBe(1);
    expect(sent).toEqual(['42:7 days left: Business Administration']);
  });

  it('a Telegram reminder goes out once, in the student’s language, and again after a bot error', async () => {
    const me = await newUser('tg-4321@telegram.invalid');
    await updateProfile(t.db, me, { reminderChannel: 'telegram', preferredLang: 'ru' });
    await t.db.insert(account).values({
      id: 'acc-tg-4321',
      accountId: '4321',
      providerId: 'telegram',
      userId: me,
      updatedAt: new Date(),
    });
    const id = await track(me, 'program', 101);
    await setDeadline(t.db, me, id, addDays(TODAY, 1));

    const sent: { chatId: string; text: string }[] = [];
    let botDown = true;
    const runWithBot = (today: string) =>
      runReminders({
        db: t.db,
        mailer,
        siteUrl: 'https://clavis.test',
        today,
        telegram: async (chatId, text) => {
          if (botDown) throw new Error('Telegram sendMessage 502');
          sent.push({ chatId, text });
        },
      });

    expect(await runWithBot(TODAY)).toMatchObject({ sent: 0, failed: 1 });
    botDown = false;
    expect(await runWithBot(TODAY)).toMatchObject({ sent: 1, failed: 0 });
    expect(await runWithBot(TODAY)).toMatchObject({ sent: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe('4321');
    expect(sent[0]?.text).toContain('Остался 1 день');
    expect(sent[0]?.text).toContain(`https://clavis.test/ru/my/tracker/${id}`);
    // Never by email: the address is a placeholder.
    expect(mails).toEqual([]);
  });
});
