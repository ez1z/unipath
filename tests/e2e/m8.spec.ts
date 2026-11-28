/**
 * M8 checks (SPEC): axe finds no serious issues; the strict CSP blocks
 * nothing the site itself uses; security headers on every kind of response;
 * 404 page; sitemap with hreflang; robots.txt. Budgets are in m2.spec.ts.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ownIpPerTest, signInByEmail, uniqueEmail } from './account.ts';
import { msg } from './helpers.ts';

ownIpPerTest();

const PUBLIC_PAGES = [
  '/tk',
  '/en/search',
  '/en/search?tab=universities',
  '/ru/universities/demo-university-1',
  '/en/programs/demo-u6-computer-science',
  '/en/colleges/demo-pathway-college-1',
  '/en/scholarships',
  '/tk/scholarships/demo-scholarship-1',
  '/en/discussions',
  '/en/compare?ids=101',
  '/en/about',
  '/en/how-we-check',
  '/en/sign-in',
  '/en/nothing-here',
];

/** CSP refusals show in the console ("Refused to …" / "Content Security Policy"). */
function watchCsp(page: Page): string[] {
  const refused: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (load|execute|apply|frame|connect)/i.test(text)) {
      refused.push(`${page.url()}: ${text}`);
    }
  });
  return refused;
}

/**
 * Scrolls every client:visible island into view so it hydrates (and runs
 * under the CSP), then waits for them. Islands in hidden parts of the layout
 * (a closed sheet, desktop-only blocks on a phone) never show, so never load.
 */
async function hydrateAll(page: Page) {
  const waiting = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('astro-island[ssr][client="visible"]')].filter((island) =>
          [...island.children].some((child) => child.getClientRects().length > 0),
        ).length,
    );
  const islands = page.locator('astro-island[client="visible"]');
  for (let i = 0; i < (await islands.count()); i++) {
    await islands.nth(i).evaluate((island) => island.firstElementChild?.scrollIntoView());
  }
  await page.waitForLoadState('networkidle');
  await expect.poll(waiting).toBe(0);
}

async function seriousIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.describe('Accessibility and CSP', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`public pages: no serious axe issues, nothing refused by the CSP (${theme})`, async ({
      page,
      context,
    }) => {
      test.slow();
      await context.addCookies([
        { name: 'clavis_theme', value: theme, url: 'http://localhost:4321' },
      ]);
      const refused = watchCsp(page);
      const issues: string[] = [];
      for (const path of PUBLIC_PAGES) {
        await page.goto(path);
        await hydrateAll(page);
        issues.push(...(await seriousIssues(page)).map((issue) => `${path}: ${issue}`));
      }
      expect(issues).toEqual([]);
      expect(refused).toEqual([]);
    });
  }

  test('account pages: no serious axe issues, nothing refused', async ({ page }, info) => {
    test.slow();
    const refused = watchCsp(page);
    await signInByEmail(page, uniqueEmail(info, 'a11y'));
    const issues: string[] = [];
    for (const path of ['/en/my', '/en/my/saved', '/en/my/share', '/en/my/profile', '/ru/my']) {
      await page.goto(path);
      await hydrateAll(page);
      issues.push(...(await seriousIssues(page)).map((issue) => `${path}: ${issue}`));
    }
    expect(issues).toEqual([]);
    expect(refused).toEqual([]);
  });
});

test.describe('Security headers', () => {
  const headerChecks = (headers: Record<string, string>) => {
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain('frame-ancestors https://web.telegram.org');
    expect(csp).toContain("object-src 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
  };

  test('on prerendered pages, server pages, cached pages, API and files', async ({ request }) => {
    for (const path of [
      '/en/about', // prerendered (public/_headers)
      '/en/search', // cached server page
      '/en/search', // the same, from the cache
      '/en/sign-in', // private server page
      '/api/search/count?kind=programs', // API
      '/favicon.svg', // static file
      '/en/nothing-here', // 404
    ]) {
      const response = await request.get(path);
      headerChecks(response.headers());
    }
  });

  test("server pages carry Astro's script hashes and no unsafe-inline", async ({ request }) => {
    const csp = (await request.get('/en/search')).headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'sha256-/);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  test('the Telegram Login Widget script is allowed on its page only', async ({ request }) => {
    const scriptSrc = async (path: string) =>
      /script-src ([^;]*)/.exec(
        (await request.get(path)).headers()['content-security-policy'] ?? '',
      )?.[1] ?? '';
    const widget = await scriptSrc('/en/sign-in/telegram');
    expect(widget).toContain('https://telegram.org');
    expect(widget).toContain("'self'");
    expect(await scriptSrc('/en/sign-in')).not.toContain('telegram.org');
    expect(await scriptSrc('/en/search')).not.toContain('telegram.org');
  });

  test('prerendered pages carry the policy as a meta tag', async ({ page }) => {
    await page.goto('/en/about');
    const meta = page.locator('meta[http-equiv="content-security-policy"]');
    await expect(meta).toHaveAttribute('content', /script-src 'self' 'sha256-/);
  });
});

test.describe('Not found', () => {
  test('an unknown address is a 404 in the language of the address', async ({ page }) => {
    const response = await page.goto('/ru/no-such-page');
    expect(response?.status()).toBe(404);
    expect(response?.headers()['cache-control']).toContain('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('ru', 'notFound.title'));
    await expect(page.getByRole('link', { name: msg('ru', 'notFound.search') })).toHaveAttribute(
      'href',
      '/ru/search',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('outside a language, it uses the saved language', async ({ page, context }) => {
    await context.addCookies([{ name: 'clavis_lang', value: 'en', url: 'http://localhost:4321' }]);
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('en', 'notFound.title'));
  });
});

test.describe('Sitemap and robots', () => {
  test('sitemap.xml lists published pages in three languages with hreflang', async ({
    request,
  }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    const body = await response.text();
    for (const lang of ['tk', 'ru', 'en']) {
      expect(body).toContain(
        `<loc>http://localhost:4321/${lang}/universities/demo-university-1</loc>`,
      );
    }
    expect(body).toContain('hreflang="x-default" href="http://localhost:4321/tk/search"');
    expect(body).not.toContain('/my');
    expect(body).not.toContain('/admin');
    // Every listed page opens.
    const locs = [...body.matchAll(/<loc>http:\/\/localhost:4321([^<]+)<\/loc>/g)].map(
      (m) => m[1] ?? '',
    );
    for (const path of locs.filter((p) => p.startsWith('/en/')).slice(0, 25)) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  test('robots.txt points at the sitemap', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('Sitemap: http://localhost:4321/sitemap.xml');
    expect(body).toContain('Disallow: /admin');
  });
});
