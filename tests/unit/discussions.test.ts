/**
 * Discussions against a local D1 with the demo seed: asking and replying,
 * daily limits, Helped me, helpful votes, reports that hide a post, similar
 * questions (FTS5), tags, nicknames and "Studies here" badge requests.
 * Seed facts: program 101 is published at university 1; university 9 and
 * program 105 are unpublished.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTranslations } from '../../src/i18n/index.ts';
import { ensureProfile, updateProfile } from '../../src/lib/account.ts';
import { threads, user, userBadges } from '../../src/lib/db/schema.ts';
import {
  authorName,
  autoNameNumber,
  createReply,
  createThread,
  DAILY_REPLIES,
  DAILY_THREADS,
  getThread,
  latestThreads,
  listMyBadges,
  listThreads,
  reportPost,
  requestBadge,
  setHelped,
  similarThreads,
  threadInputSchema,
  threadsTagged,
  toSimilarQuery,
  topicCounts,
  voteHelpful,
  withdrawBadgeRequest,
  type ThreadInput,
} from '../../src/lib/discussions.ts';
import { linkSegments, postParagraphs } from '../../src/lib/discussions-view.ts';
import { createTestDb, type TestDb } from './db/test-db.ts';

let t: TestDb;
let n = 0;

async function newUser(): Promise<string> {
  const id = `poster-${++n}`;
  await t.db.insert(user).values({ id, name: '', email: `${id}@mail.test`, emailVerified: true });
  await ensureProfile(t.db, id, 'en');
  return id;
}

function input(patch: Partial<ThreadInput> = {}): ThreadInput {
  return {
    topic: 'scholarships',
    title: 'How do I apply for a scholarship in Hungary?',
    body: 'I have IELTS 6.5.\nWhat else do I need?',
    postLang: 'en',
    universityId: null,
    programId: null,
    ...patch,
  };
}

async function ask(userId: string, patch: Partial<ThreadInput> = {}): Promise<number> {
  const result = await createThread(t.db, userId, input(patch));
  if (!result.ok) throw new Error(`ask failed: ${result.error}`);
  return result.id;
}

async function answer(userId: string, threadId: number, body = 'Check the official site first.') {
  const result = await createReply(t.db, userId, threadId, body);
  if (!result.ok) throw new Error(`reply failed: ${result.error}`);
  return result.id;
}

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

describe('asking and replying', () => {
  it('a new question shows on its board and in New in Discussions', async () => {
    const me = await newUser();
    const id = await ask(me, {
      topic: 'tests',
      title: 'Is IELTS 5.5 enough for a foundation year?',
    });
    const board = await listThreads(t.db, 'en', 'tests');
    expect(board.items.map((i) => i.id)).toContain(id);
    expect(board.items.find((i) => i.id === id)).toMatchObject({
      lang: 'en',
      answered: false,
      replyCount: 0,
    });
    expect((await latestThreads(t.db, 'en', 50)).map((i) => i.id)).toContain(id);
    expect((await topicCounts(t.db)).get('tests')).toBeGreaterThan(0);
  });

  it('a reply counts and moves the question up', async () => {
    const asker = await newUser();
    const helper = await newUser();
    const older = await ask(asker, {
      topic: 'life-abroad',
      title: 'Where do students live in Ankara?',
    });
    const newer = await ask(asker, {
      topic: 'life-abroad',
      title: 'Can students work part time in Turkey?',
    });
    let board = await listThreads(t.db, 'en', 'life-abroad');
    expect(board.items[0]?.id).toBe(newer);
    await answer(helper, older);
    board = await listThreads(t.db, 'en', 'life-abroad');
    expect(board.items[0]).toMatchObject({ id: older, replyCount: 1 });
  });

  it('validates titles and keeps line breaks in the body', () => {
    expect(threadInputSchema.safeParse({ ...input(), title: 'Too short' }).success).toBe(false);
    expect(threadInputSchema.safeParse({ ...input(), topic: 'other' }).success).toBe(false);
    const ok = threadInputSchema.parse({
      ...input(),
      title: '  Visa   for\nPoland?  Need help  ',
      body: 'line one\r\nline two\n\n\n\nnext\u0000',
      universityId: '',
    });
    expect(ok.title).toBe('Visa for Poland? Need help');
    expect(ok.body).toBe('line one\nline two\n\nnext');
    expect(ok.universityId).toBeNull();
  });

  it('a program tag also tags its university; unpublished records are refused', async () => {
    const me = await newUser();
    const id = await ask(me, { programId: 101 });
    const row = await t.db.select().from(threads).where(eq(threads.id, id)).get();
    expect(row).toMatchObject({ programId: 101, universityId: 1 });
    expect(
      (await threadsTagged(t.db, 'en', { type: 'university', id: 1 })).map((i) => i.id),
    ).toContain(id);
    expect((await threadsTagged(t.db, 'en', { type: 'program', id: 101 }))[0]?.tag).toMatchObject({
      type: 'program',
      path: expect.stringMatching(/^\/programs\//),
    });
    expect(await createThread(t.db, me, input({ universityId: 9 }))).toEqual({
      ok: false,
      error: 'tag',
    });
    expect(await createThread(t.db, me, input({ programId: 105 }))).toEqual({
      ok: false,
      error: 'tag',
    });
  });
});

describe('daily limits', () => {
  it(`${DAILY_THREADS} questions a day; older ones don't count`, async () => {
    const me = await newUser();
    const now = new Date('2026-12-01T10:00:00Z');
    const yesterday = new Date(now.getTime() - 25 * 3600_000);
    expect((await createThread(t.db, me, input(), yesterday)).ok).toBe(true);
    for (let i = 0; i < DAILY_THREADS; i++) {
      expect((await createThread(t.db, me, input(), now)).ok).toBe(true);
    }
    expect(await createThread(t.db, me, input(), now)).toEqual({ ok: false, error: 'daily' });
    const tomorrow = new Date(now.getTime() + 24 * 3600_000 + 1000);
    expect((await createThread(t.db, me, input(), tomorrow)).ok).toBe(true);
  });

  it(`${DAILY_REPLIES} replies a day`, async () => {
    const asker = await newUser();
    const me = await newUser();
    const id = await ask(asker);
    const now = new Date();
    for (let i = 0; i < DAILY_REPLIES; i++) {
      expect((await createReply(t.db, me, id, `Answer number ${i}`, now)).ok).toBe(true);
    }
    expect(await createReply(t.db, me, id, 'One more', now)).toEqual({ ok: false, error: 'daily' });
    // Someone else can still reply.
    expect((await createReply(t.db, asker, id, 'Thanks all', now)).ok).toBe(true);
    // 32 writes through the local D1 proxy: over 5 s when the whole suite runs at once.
  }, 20_000);
});

describe('Helped me and Helpful', () => {
  it('only the asker pins a reply; the thread is Answered and the reply comes first', async () => {
    const asker = await newUser();
    const a = await newUser();
    const b = await newUser();
    const id = await ask(asker);
    const first = await answer(a, id);
    const second = await answer(b, id);
    expect(await setHelped(t.db, a, id, second)).toBe('notAsker');
    expect(await setHelped(t.db, asker, id, 999_999)).toBe('notFound');
    expect(await setHelped(t.db, asker, id, second)).toBe('ok');
    const page = await getThread(t.db, 'en', id);
    expect(page?.thread).toMatchObject({ answered: true, helpedReplyId: second });
    expect(page?.replies.map((r) => r.id)).toEqual([second, first]);
    expect(await setHelped(t.db, asker, id, null)).toBe('ok');
    expect((await getThread(t.db, 'en', id))?.thread.answered).toBe(false);
  });

  it('one helpful vote per student, never on their own reply', async () => {
    const asker = await newUser();
    const helper = await newUser();
    const voter = await newUser();
    const id = await ask(asker);
    const replyId = await answer(helper, id);
    expect(await voteHelpful(t.db, helper, replyId, true)).toEqual({ ok: false, error: 'own' });
    expect(await voteHelpful(t.db, voter, replyId, true)).toMatchObject({ ok: true, count: 1 });
    expect(await voteHelpful(t.db, voter, replyId, true)).toMatchObject({ ok: true, count: 1 });
    expect(await voteHelpful(t.db, asker, replyId, true)).toMatchObject({ ok: true, count: 2 });
    const seen = await getThread(t.db, 'en', id, voter);
    expect(seen?.replies[0]).toMatchObject({ helpfulCount: 2, votedByViewer: true });
    expect((await getThread(t.db, 'en', id, helper))?.replies[0]?.votedByViewer).toBe(false);
    expect(await voteHelpful(t.db, voter, replyId, false)).toMatchObject({ ok: true, count: 1 });
  });
});

describe('reports', () => {
  it('three reports from different students hide a reply and unpin it', async () => {
    const asker = await newUser();
    const spammer = await newUser();
    const id = await ask(asker);
    const bad = await answer(spammer, id, 'Buy essays here');
    await setHelped(t.db, asker, id, bad);
    expect(
      await reportPost(t.db, spammer, { targetType: 'reply', targetId: bad, reason: 'spam' }),
    ).toEqual({ ok: false, error: 'own' });

    const [r1, r2, r3] = [await newUser(), await newUser(), await newUser()];
    const report = (who: string) =>
      reportPost(t.db, who, { targetType: 'reply', targetId: bad, reason: 'spam' });
    expect(await report(r1)).toMatchObject({ ok: true, hidden: false, threadId: id });
    // The same student twice still counts once.
    expect(await report(r1)).toMatchObject({ ok: true, hidden: false });
    expect(await report(r2)).toMatchObject({ ok: true, hidden: false });
    expect((await getThread(t.db, 'en', id, r1))?.replies[0]?.reportedByViewer).toBe(true);
    expect(await report(r3)).toMatchObject({ ok: true, hidden: true });

    const page = await getThread(t.db, 'en', id);
    expect(page?.replies[0]?.status).toBe('hidden');
    expect(page?.thread.helpedReplyId).toBeNull();
    // Nobody can vote on or pin a hidden reply.
    expect(await voteHelpful(t.db, r1, bad, true)).toEqual({ ok: false, error: 'notFound' });
    expect(await setHelped(t.db, asker, id, bad)).toBe('notFound');
  });

  it('three reports hide a question from its board; it takes no new replies', async () => {
    const asker = await newUser();
    const id = await ask(asker, {
      topic: 'for-parents',
      title: 'Selling ready-made essays, cheap',
    });
    for (let i = 0; i < 3; i++) {
      await reportPost(t.db, await newUser(), {
        targetType: 'thread',
        targetId: id,
        reason: 'spam',
      });
    }
    expect((await listThreads(t.db, 'en', 'for-parents')).items.map((i) => i.id)).not.toContain(id);
    expect((await getThread(t.db, 'en', id))?.thread.status).toBe('hidden');
    expect(await createReply(t.db, await newUser(), id, 'Hello there')).toEqual({
      ok: false,
      error: 'closed',
    });
  });
});

describe('similar questions', () => {
  it('finds open questions sharing words, diacritics folded, best first', async () => {
    const me = await newUser();
    const target = await ask(me, {
      topic: 'documents-and-visas',
      title: 'Türkiýe üçin wiza näçe wagtda berilýär?',
      postLang: 'tk',
    });
    await ask(me, {
      topic: 'documents-and-visas',
      title: 'Which documents for a student visa to Poland?',
    });
    const found = await similarThreads(t.db, 'en', 'turkiye wiza');
    expect(found[0]?.id).toBe(target);
    expect(found[0]?.lang).toBe('tk');
    expect((await similarThreads(t.db, 'en', 'student visa poland')).length).toBeGreaterThan(0);
    // The thread itself is left out on its own page.
    expect(
      (await similarThreads(t.db, 'en', 'turkiye wiza', target)).map((i) => i.id),
    ).not.toContain(target);
    expect(await similarThreads(t.db, 'en', 'a b')).toEqual([]);
    expect(await similarThreads(t.db, 'en', '" OR * NEAR(')).toEqual([]);
  });

  it('turns a title into a safe OR query of its words', () => {
    expect(toSimilarQuery('Visa: "Poland" OR*?')).toBe('"visa"* OR "poland"*');
    expect(toSimilarQuery('a ab')).toBeNull();
  });
});

describe('authors and badges', () => {
  it('nickname, else a stable "Student NNNN"', async () => {
    const tr = getTranslations('en');
    const me = await newUser();
    const id = await ask(me);
    const anon = (await getThread(t.db, 'en', id))?.thread.author;
    expect(anon?.nickname).toBeNull();
    const shown = authorName(tr, anon ?? { id: me, nickname: null });
    expect(shown).toMatch(/^Student \d{4}$/);
    expect(autoNameNumber(me)).toBe(autoNameNumber(me));
    await updateProfile(t.db, me, { displayName: 'Aýna' });
    const named = (await getThread(t.db, 'en', id))?.thread.author;
    expect(authorName(tr, named ?? { id: me, nickname: null })).toBe('Aýna');
  });

  it('a Studies here request waits for a check; once verified it shows on posts', async () => {
    const me = await newUser();
    const note = 'Second year of Business, student email @demo.edu';
    expect(await requestBadge(t.db, me, { universityId: 1, note })).toBe('ok');
    expect(await requestBadge(t.db, me, { universityId: 1, note })).toBe('exists');
    expect(await requestBadge(t.db, me, { universityId: 9, note })).toBe('notFound');
    expect(await requestBadge(t.db, me, { universityId: 2, note })).toBe('ok');
    expect(await requestBadge(t.db, me, { universityId: 3, note })).toBe('ok');
    expect(await requestBadge(t.db, me, { universityId: 4, note })).toBe('limit');

    const mine = await listMyBadges(t.db, me, 'en');
    expect(mine).toHaveLength(3);
    expect(mine.every((b) => !b.verified)).toBe(true);
    const id = await ask(me);
    expect((await getThread(t.db, 'en', id))?.thread.author.studiesAt).toEqual([]);

    // An admin approves the first (M7 queue).
    const first = mine.find((b) => b.university?.text.includes('1'));
    await t.db
      .update(userBadges)
      .set({ verifiedAt: new Date() })
      .where(eq(userBadges.id, first?.id ?? 0));
    const author = (await getThread(t.db, 'en', id))?.thread.author;
    expect(author?.studiesAt.map((u) => u.id)).toEqual([1]);

    // Withdraw a pending one; a verified one can't be withdrawn this way.
    const pending = mine.find((b) => b.id !== first?.id);
    expect(await withdrawBadgeRequest(t.db, me, pending?.id ?? 0)).toBe(true);
    expect(await withdrawBadgeRequest(t.db, me, first?.id ?? 0)).toBe(false);
    expect(await withdrawBadgeRequest(t.db, await newUser(), mine[2]?.id ?? 0)).toBe(false);
  });
});

describe('post text', () => {
  it('links only http(s) URLs and leaves trailing punctuation outside', () => {
    expect(linkSegments('See https://example.edu/apply.')).toEqual([
      { text: 'See ' },
      { href: 'https://example.edu/apply', text: 'https://example.edu/apply' },
      { text: '.' },
    ]);
    expect(linkSegments('javascript:alert(1) and <b>bold</b>')).toEqual([
      { text: 'javascript:alert(1) and <b>bold</b>' },
    ]);
    expect(linkSegments('(https://en.wikipedia.org/wiki/Ankara_(city))')[1]).toMatchObject({
      href: 'https://en.wikipedia.org/wiki/Ankara_(city)',
    });
  });

  it('splits paragraphs and lines', () => {
    expect(postParagraphs('one\ntwo\n\nthree')).toEqual([
      [[{ text: 'one' }], [{ text: 'two' }]],
      [[{ text: 'three' }]],
    ]);
  });
});
