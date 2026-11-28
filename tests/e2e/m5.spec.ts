/**
 * M5 · Discussions: ask (with similar questions while typing), reply, Helped
 * me and Helpful; three reports hide a post; the daily limit answers with a
 * clear message; tags show on the university's Discussion tab; JavaScript off.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { ownIpPerTest, signInByEmail, testIp, uniqueEmail } from './account.ts';
import { fill, hasNoHorizontalOverflow, msg } from './helpers.ts';

ownIpPerTest();

/** Another student in their own browser, signing in from their own address. */
async function student(
  browser: Browser,
  info: TestInfo,
  name: string,
  n: number,
  options: { javaScriptEnabled?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  const ip = testIp(info).replace(/\.\d+$/, `.${(Number(testIp(info).split('.')[3]) + n) % 250}`);
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip });
  const page = await context.newPage();
  await signInByEmail(page, uniqueEmail(info, `${name}${n}`));
  return { context, page };
}

/** Asks through the JSON endpoint; returns the thread's path. */
async function askByApi(page: Page, title: string, extra: Record<string, unknown> = {}) {
  const response = await page.request.post('/api/discussions/thread', {
    data: {
      lang: 'en',
      topic: 'scholarships',
      title,
      body: 'Details of the question.',
      postLang: 'en',
      ...extra,
    },
  });
  return { response, href: ((await response.json()) as { href?: string }).href ?? '' };
}

async function replyByApi(page: Page, threadPath: string, body: string) {
  const threadId = Number(threadPath.split('/').pop());
  const response = await page.request.post('/api/discussions/reply', {
    data: { lang: 'en', threadId, body },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { id: number }).id;
}

test('ask, reply, Helped me and Helpful', async ({ page, browser }, info) => {
  const stamp = Date.now();
  const title = `Which documents does the Hungary scholarship need ${stamp}?`;
  await signInByEmail(page, uniqueEmail(info, 'asker'));

  await page.goto('/en/discussions');
  await page
    .getByRole('link', { name: msg('en', 'discussions.ask') })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/discussions\/ask$/);
  await page.getByLabel(msg('en', 'discussions.form.topic')).selectOption('scholarships');
  await page.getByLabel(msg('en', 'discussions.form.title'), { exact: true }).fill(title);
  await page
    .getByLabel(msg('en', 'discussions.form.body'))
    .fill('I have IELTS 6.5.\nWhat else? See https://example.edu/apply.');
  await page.getByLabel(msg('en', 'discussions.form.nickname')).fill(`Asker${stamp % 1000}`);
  await page.getByRole('button', { name: msg('en', 'discussions.form.post') }).click();

  await expect(page).toHaveURL(/\/en\/discussions\/scholarships\/\d+$/);
  const threadPath = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const link = page.locator('.question').getByRole('link', { name: 'https://example.edu/apply' });
  await expect(link).toHaveAttribute('rel', /nofollow ugc/);
  await expect(page.locator('.question').getByText(`Asker${stamp % 1000}`)).toBeVisible();
  expect(await hasNoHorizontalOverflow(page)).toBe(true);

  // Another student finds it while typing a similar question, then replies.
  const helper = await student(browser, info, 'helper', 1);
  await helper.page.goto('/en/discussions/ask');
  await helper.page
    .getByLabel(msg('en', 'discussions.form.title'), { exact: true })
    .pressSequentially(`hungary scholarship documents ${stamp}`, { delay: 5 });
  await expect(helper.page.getByRole('link', { name: title })).toBeVisible();
  await helper.page.goto(threadPath);
  await helper.page
    .getByLabel(msg('en', 'discussions.replyLabel'))
    .fill('A passport and transcripts.');
  await helper.page.getByRole('button', { name: msg('en', 'discussions.replySend') }).click();
  await expect(helper.page).toHaveURL(/#reply-\d+$/);
  const reply = helper.page.locator('.reply', { hasText: 'A passport and transcripts.' });
  await expect(reply).toBeVisible();
  // Not on one's own reply: no Helpful button, no Report.
  await expect(reply.getByRole('button', { name: /^Helpful/ })).toHaveCount(0);
  await expect(reply.getByText(msg('en', 'discussions.report'), { exact: true })).toHaveCount(0);

  // The asker marks it Helped me and votes it Helpful.
  await page.reload();
  const answer = page.locator('.reply', { hasText: 'A passport and transcripts.' });
  await answer.getByRole('button', { name: msg('en', 'discussions.helpedMe') }).click();
  await expect(
    page.locator('.question').getByText(msg('en', 'discussions.answered')),
  ).toBeVisible();
  const pinned = page.locator('.reply.pinned');
  await expect(pinned.getByText(msg('en', 'discussions.helpedAsker'))).toBeVisible();
  await expect(pinned).toContainText('A passport and transcripts.');
  const vote = pinned.getByRole('button', { name: /^Helpful/ });
  await expect(vote).toHaveAttribute('aria-pressed', 'false');
  await vote.click();
  await expect(
    page.locator('.reply.pinned').getByRole('button', { name: /^Helpful/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.reply.pinned')).toContainText(
    `${msg('en', 'discussions.helpful')} · 1`,
  );

  // The helper sees no Helped me buttons: only the asker gets them.
  await helper.page.reload();
  await expect(
    helper.page.getByRole('button', { name: msg('en', 'discussions.helpedMe') }),
  ).toHaveCount(0);

  // The board lists it as Answered, with its language label.
  await page.goto('/en/discussions/scholarships');
  const row = page.locator('.thread-row', { hasText: title });
  await expect(row.getByText(msg('en', 'discussions.answered'))).toBeVisible();
  await expect(row.getByText(msg('en', 'discussions.lang.en'))).toBeAttached();
  await helper.context.close();
});

test('three reports hide a reply until the team reviews it', async ({ page, browser }, info) => {
  await signInByEmail(page, uniqueEmail(info, 'reported-asker'));
  const { href } = await askByApi(page, `Is a paid agent worth it ${Date.now()}?`);
  const spammer = await student(browser, info, 'spammer', 1);
  await replyByApi(spammer.page, href, 'Pay my agency and we do everything');

  for (const n of [2, 3, 4]) {
    const reporter = await student(browser, info, 'reporter', n);
    await reporter.page.goto(href);
    const post = reporter.page.locator('.reply', { hasText: 'Pay my agency' });
    await post.getByText(msg('en', 'discussions.report'), { exact: true }).click();
    await post.getByLabel(msg('en', 'discussions.reason.spam')).check();
    await post.getByRole('button', { name: msg('en', 'discussions.reportSend') }).click();
    // The first two see their report noted; the third report hides the reply at once.
    await expect(
      reporter.page.getByText(
        msg('en', n < 4 ? 'discussions.reported' : 'discussions.hiddenReply'),
      ),
    ).toBeVisible();
    await reporter.context.close();
  }

  // Hidden for everyone, signed in or not; the question itself stays.
  await page.goto(href);
  await expect(page.getByText(msg('en', 'discussions.hiddenReply'))).toBeVisible();
  await expect(page.getByText('Pay my agency')).toHaveCount(0);
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(href);
  await expect(visitorPage.getByText(msg('en', 'discussions.hiddenReply'))).toBeVisible();
  await expect(visitorPage.getByText('Pay my agency')).toHaveCount(0);
  await visitor.close();
  await spammer.context.close();
});

test('the sixth question in a day gets a clear message', async ({ page }, info) => {
  await signInByEmail(page, uniqueEmail(info, 'busy'));
  for (let i = 1; i <= 5; i++) {
    const { response } = await askByApi(page, `Question number ${i} about visas ${Date.now()}`);
    expect(response.status()).toBe(200);
  }
  const { response } = await askByApi(page, `Question number 6 about visas ${Date.now()}`);
  expect(response.status()).toBe(429);
  expect(await response.json()).toEqual({ error: 'daily' });

  // The form says so in words.
  await page.goto('/en/discussions/ask?topic=tests');
  await page
    .getByLabel(msg('en', 'discussions.form.title'), { exact: true })
    .fill('One more question about IELTS?');
  await page.getByLabel(msg('en', 'discussions.form.body')).fill('Details.');
  await page.getByRole('button', { name: msg('en', 'discussions.form.post') }).click();
  await expect(page.getByRole('alert')).toHaveText(
    fill('en', 'discussions.error.daily', { threads: 5, replies: 30 }),
  );
});

test('a question about a program shows on its university Discussion tab', async ({
  page,
}, info) => {
  await signInByEmail(page, uniqueEmail(info, 'tagger'));
  await page.goto('/en/programs/demo-u1-business-administration');
  await page.getByRole('link', { name: msg('en', 'discussions.ask') }).click();
  const title = `Business Administration in Ankara: hard to get in ${Date.now()}?`;
  await page.getByLabel(msg('en', 'discussions.form.title'), { exact: true }).fill(title);
  await page.getByLabel(msg('en', 'discussions.form.body')).fill('Grades of 4.5 out of 5.');
  await page.getByRole('button', { name: msg('en', 'discussions.form.post') }).click();
  await expect(page.getByRole('link', { name: /^About Business Administration/ })).toBeVisible();

  // The university's Discussion tab is fresh for a signed-in student. (The
  // program page itself is cached for ten minutes, so the list there catches up.)
  await page.goto('/en/universities/demo-university-1?tab=discussion');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
});

test.describe('JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('signed out: reading works and Reply leads to sign-in', async ({ page, browser }, info) => {
    const asker = await student(browser, info, 'nojs-asker', 1);
    const { href } = await askByApi(asker.page, `Where to live in Budapest ${Date.now()}?`);
    await replyByApi(asker.page, href, 'Following this.');
    await asker.context.close();

    await page.goto('/en/discussions');
    await expect(
      page.getByRole('heading', { level: 1, name: msg('en', 'discussions.title') }),
    ).toBeVisible();
    await page.goto(href);
    await expect(page.getByText('Following this.')).toBeVisible();
    await page.getByRole('link', { name: msg('en', 'discussions.signInToReply') }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?/);
  });

  test('signed in: reply and vote with plain forms', async ({ page, browser }, info) => {
    const asker = await student(browser, info, 'nojs-q', 1);
    const { href } = await askByApi(asker.page, `IELTS or Duolingo for Poland ${Date.now()}?`);
    await replyByApi(asker.page, href, 'IELTS is accepted everywhere.');
    await asker.context.close();

    await signInByEmail(page, uniqueEmail(info, 'nojs-voter'));
    await page.goto(href);
    await page.getByRole('button', { name: /^Helpful/ }).click();
    await expect(page.getByRole('button', { name: /^Helpful/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByLabel(msg('en', 'discussions.replyLabel')).fill('Duolingo works for some too.');
    await page.getByRole('button', { name: msg('en', 'discussions.replySend') }).click();
    await expect(page.getByText('Duolingo works for some too.')).toBeVisible();
    await expect(page.locator('.question')).toContainText('2 replies');
  });
});
