/**
 * Signing in for end-to-end tests, with local stand-ins only: codes come from
 * the local dev mailbox (/api/dev/mailbox), never from real email.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { fill, msg } from './helpers.ts';

/** Each test signs in from its own address, so the per-IP sign-in limit doesn't spill over. */
export function testIp(info: TestInfo): string {
  let hash = 0;
  for (const c of `${info.project.name}/${info.testId}/${info.retry}`) {
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  }
  return `10.${(hash >> 16) & 255}.${(hash >> 8) & 255}.${hash & 255}`;
}

export function uniqueEmail(info: TestInfo, name: string): string {
  return `${name}-${info.project.name}-${Date.now()}-${info.retry}@mail.test`;
}

/** Call at the top of a spec: each test gets its own IP for the rate limits. */
export function ownIpPerTest() {
  test.beforeEach(async ({ context }, info) => {
    await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': testIp(info) });
  });
}

/** The last code "sent" to this address (printed to the console, kept in the dev mailbox). */
export async function codeFor(page: Page, email: string): Promise<string> {
  let code = '';
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(email)}`);
      if (!response.ok()) return '';
      code = ((await response.json()) as { code: string | null }).code ?? '';
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code;
}

/** Signs in on the sign-in page (plain forms: the same with JavaScript on or off). */
export async function signInOnPage(page: Page, email: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: msg('en', 'signIn.title') }),
  ).toBeVisible();
  await page.getByLabel(msg('en', 'signIn.emailLabel')).fill(email);
  await page.getByRole('button', { name: msg('en', 'signIn.email') }).click();
  await expect(page.getByText(fill('en', 'signIn.codeSent', { email }))).toBeVisible();
  await page.getByLabel(msg('en', 'signIn.codeLabel')).fill(await codeFor(page, email));
  await page.getByRole('button', { name: msg('en', 'signIn.verify'), exact: true }).click();
}

export async function signInByEmail(page: Page, email: string) {
  await page.goto('/en/sign-in');
  await signInOnPage(page, email);
  await expect(page).toHaveURL(/\/en\/my$/);
}
