/**
 * M2 checks (SPEC): a first visit, finding a program and finding a scholarship,
 * on phone and desktop; every page renders with JavaScript off; page budgets.
 * Runs against `pnpm build && pnpm preview` with the demo seed in the local D1.
 */
import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { fill, hasNoHorizontalOverflow, isPhone, literal, mainNav, msg } from './helpers';

// Computer Science (601): direct entry plus two pre-year routes.
const PROGRAM = '/en/programs/demo-u6-computer-science';
const SCHOLARSHIP = '/en/scholarships/demo-scholarship-1';

/**
 * Opens the filter controls: the sheet on phones; on desktop they're always shown.
 * With JavaScript on, waits for the island (client:visible) to hydrate, which on
 * phones only happens once the sheet is open.
 */
async function openFilters(page: Page, projectName: string, live = true) {
  if (isPhone(projectName)) {
    await page.getByRole('button', { name: /^Filters/ }).click();
  }
  const sheet = page.locator('#filters-sheet');
  await expect(sheet).toBeVisible();
  if (live) {
    await expect(page.locator('astro-island:has(#filters)')).not.toHaveAttribute('ssr', /.*/);
  }
  return sheet;
}

test.describe('First visit', () => {
  test('opens Home in Turkmen with search, quick starts and popular countries', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tk$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('tk', 'home.headline'));
    await expect(page.getByRole('searchbox', { name: msg('tk', 'searchBox.label') })).toBeVisible();

    const quick = page.getByRole('list', { name: msg('tk', 'home.chips') });
    await expect(quick.getByRole('link')).toHaveText([
      msg('tk', 'home.chip.approved'),
      msg('tk', 'home.chip.funded'),
      msg('tk', 'home.chip.countries'),
    ]);
    const countries = page.locator('#countries .tile');
    expect(await countries.count()).toBeGreaterThan(0);

    // Deadlines sit on desktop Home; phones keep Home short.
    await expect(page.getByRole('heading', { name: msg('tk', 'home.deadlines') })).toBeVisible({
      visible: !isPhone(testInfo.project.name),
    });
    await expect(page.getByText(msg('tk', 'home.trust'))).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // A country tile opens Search filtered to that country.
    await countries.first().click();
    await expect(page).toHaveURL(/\/tk\/search\?country=[A-Z]{2}$/);
    await expect(page.locator('.program-card').first()).toBeVisible();
  });

  test('"Ministry approved" on Home shows only approved universities\' programs', async ({
    page,
  }) => {
    await page.goto('/en');
    await page.getByRole('link', { name: msg('en', 'home.chip.approved') }).click();
    await expect(page).toHaveURL(/\/en\/search\?approved=1$/);
    expect(await page.locator('.program-card').count()).toBeGreaterThan(0);
    // University programs carry the approved badge; a college's pre-year has no badge
    // of its own (colleges aren't on the list) and is shown because it leads to one.
    const badges = page.locator('.program-card .ministry-badge');
    expect(await badges.count()).toBeGreaterThan(0);
    await expect(page.locator('.program-card .ministry-badge:not(.approved)')).toHaveCount(0);
  });
});

test.describe('Find a program', () => {
  test('search, filter, open a program, read its path and Ministry status', async ({
    page,
  }, testInfo) => {
    await page.goto('/en');
    const box = page.getByRole('searchbox', { name: msg('en', 'searchBox.label') });
    await box.fill('economics');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/en\/search\?q=economics$/);
    await expect(page.locator('#results-count')).toHaveText(/^\d+ programs?$/);

    // Filter to approved universities: sheet + live count on phones, auto-apply on desktop.
    const sheet = await openFilters(page, testInfo.project.name);
    await sheet.getByLabel(msg('en', 'filter.approvedOnly')).check();
    if (isPhone(testInfo.project.name)) {
      await expect(sheet.getByRole('button', { name: /^Show \d+ results?$/ })).toBeVisible();
      await sheet.getByRole('button', { name: /^Show / }).click();
    }
    await expect(page).toHaveURL(/q=economics&approved=1/);
    const chip = page.getByRole('link', {
      name: fill('en', 'search.removeFilter', { label: msg('en', 'filter.approvedOnly') }),
    });
    await expect(chip).toBeVisible();

    await page.locator('.program-card .card-title a').first().click();
    await expect(page).toHaveURL(/\/en\/programs\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Every record shows Last checked and Source.
    await expect(page.getByText(/^Last checked /).first()).toBeVisible();
    await expect(page.getByRole('link', { name: msg('en', 'common.source') })).toBeVisible();

    // The Ministry badge explains itself.
    await page.locator('.ministry-badge').first().click();
    await expect(page.getByText(msg('en', 'ministry.explain.approved'))).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(msg('en', 'ministry.explain.approved'))).toBeHidden();

    await expect(page.getByRole('heading', { name: msg('en', 'path.title') })).toBeVisible();
    await expect(
      page
        .locator('.path-card')
        .getByText(/\d+ years? total/)
        .first(),
    ).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test("Your path switches between routes to the bachelor's", async ({ page }) => {
    await page.goto(PROGRAM);
    const options = page.locator('.path-card .switch label');
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
    await expect(page.locator('.path-card .panel-0')).toBeVisible();
    await expect(page.locator('.path-card .panel-1')).toBeHidden();
    await options.nth(1).click();
    await expect(page.locator('.path-card .panel-1')).toBeVisible();
    await expect(page.locator('.path-card .panel-0')).toBeHidden();
  });

  test('the Universities tab lists universities and opens one', async ({ page }) => {
    await page.goto('/en/search');
    await page
      .getByRole('navigation', { name: msg('en', 'search.tabs') })
      .getByRole('link', { name: msg('en', 'search.tab.universities') })
      .click();
    await expect(page).toHaveURL(/tab=universities/);
    await expect(page.locator('#results-count')).toHaveText(/^\d+ universit(y|ies)$/);
    await page.locator('.university-card .card-title a').first().click();
    await expect(page).toHaveURL(/\/en\/universities\//);
    await page.getByRole('link', { name: msg('en', 'university.tab.costs') }).click();
    await expect(page).toHaveURL(/tab=costs/);
    await expect(page.getByText(msg('en', 'university.costsNote'))).toBeVisible();
  });
});

test.describe('Compare', () => {
  test("compares paths to a bachelor's side by side", async ({ page }) => {
    await page.goto('/en/search?level=bachelor');
    const toggles = page.locator('.program-card [data-compare-key]');
    await toggles.nth(0).click();
    await toggles.nth(1).click();
    await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true');

    const bar = page.locator('[data-compare-bar]');
    await expect(bar.getByRole('link')).toHaveText(fill('en', 'compare.bar', { n: 2 }));
    await bar.getByRole('link').click();
    await expect(page).toHaveURL(/\/en\/compare\?ids=\d+%2C\d+|\/en\/compare\?ids=\d+,\d+/);

    const table = page.getByRole('table', { name: msg('en', 'compare.title') });
    await expect(table.locator('thead th')).toHaveCount(2);
    await expect(
      table.getByRole('rowheader', { name: msg('en', 'compare.row.totalYears') }),
    ).toBeVisible();

    // Removing a column updates the page and the stored picks.
    await table
      .getByRole('link', { name: /^Remove / })
      .first()
      .click();
    await expect(page.getByRole('table').locator('thead th')).toHaveCount(1);
  });

  test("a bachelor's that needs a pre-year is compared with its shortest pre-year", async ({
    page,
  }) => {
    // 202 (Economics) requires a pre-year; none is picked in the URL.
    await page.goto('/en/compare?ids=202');
    await expect(page.getByText(msg('en', 'compare.autoPreYear'))).toBeVisible();
    await expect(page.locator('.path li')).toHaveCount(2);
  });
});

test.describe('Find a scholarship', () => {
  test('browse, filter by coverage, open one and check eligibility', async ({ page }, testInfo) => {
    await page.goto('/en');
    await mainNav(page, testInfo.project.name)
      .getByRole('link', { name: msg('en', 'nav.scholarships') })
      .click();
    await expect(page).toHaveURL(/\/en\/scholarships$/);
    await expect(page.locator('#results-count')).toHaveText(/^\d+ scholarships?$/);

    const sheet = await openFilters(page, testInfo.project.name);
    await sheet.getByLabel(msg('en', 'coverage.full')).check();
    if (isPhone(testInfo.project.name)) {
      await sheet.getByRole('button', { name: /^Show / }).click();
    }
    await expect(page).toHaveURL(/coverage=full/);
    const cards = page.locator('.scholarship-card');
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.getByText(msg('en', 'coverage.full'))).toBeVisible();
    }

    await cards.first().locator('.card-title a').click();
    await expect(page).toHaveURL(/\/en\/scholarships\//);
    await expect(page.getByText(/^Last checked /).first()).toBeVisible();
    await expect(page.getByText(msg('en', 'summary.covers'))).toBeVisible();

    const checklist = page.locator('.eligibility');
    const boxes = checklist.getByRole('checkbox');
    if ((await boxes.count()) > 0) {
      // client:visible: scroll it in and wait for hydration before ticking.
      await checklist.scrollIntoViewIfNeeded();
      await expect(checklist.locator('astro-island')).not.toHaveAttribute('ssr', /.*/);
      await boxes.first().check();
      if ((await boxes.count()) > 1) {
        await expect(checklist.getByText(/^Missing: /)).toBeVisible();
      }
      for (const box of await boxes.all()) await box.check();
      await expect(checklist.getByText(msg('en', 'scholarship.fit'))).toBeVisible();
    }
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});

test.describe('With JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of [
    '/tk',
    '/ru/search',
    '/en/search?tab=universities',
    PROGRAM,
    '/en/universities/demo-university-1',
    '/en/colleges/demo-pathway-college-1',
    '/ru/scholarships',
    SCHOLARSHIP,
    '/en/compare?ids=101,203-201',
    '/en/about',
    '/tk/how-we-check',
    '/ru/privacy',
  ]) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });
  }

  test('filters work as a plain form', async ({ page }, testInfo) => {
    await page.goto('/en/search');
    // The sheet is a declarative popover: it opens without JavaScript.
    const sheet = await openFilters(page, testInfo.project.name, false);
    await sheet.getByLabel(msg('en', 'filter.approvedOnly')).check();
    await sheet.getByRole('button', { name: msg('en', 'search.apply') }).click();
    await expect(page).toHaveURL(/approved=1/);
    await expect(page.locator('#results-count')).toHaveText(/^\d+ programs?$/);
  });

  test('Your path switches without JavaScript', async ({ page }) => {
    await page.goto(PROGRAM);
    await page.locator('.path-card .switch label').nth(1).click();
    await expect(page.locator('.path-card .panel-1')).toBeVisible();
    await expect(page.locator('.path-card .panel-0')).toBeHidden();
  });

  test('Report a mistake validates and thanks', async ({ page }) => {
    await page.goto('/en/programs/demo-u1-business-administration');
    await page.getByRole('link', { name: msg('en', 'common.reportMistake') }).click();
    await expect(page).toHaveURL(/\/en\/report\?type=program&id=101/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const field = page.getByLabel(msg('en', 'report.message'));
    await field.fill('Too short');
    await page.getByRole('button', { name: msg('en', 'report.submit') }).click();
    await expect(page.getByRole('alert')).toHaveText(msg('en', 'report.error.short'));
    await expect(field).toHaveValue('Too short');

    await field.fill('The tuition on the official page is different from the one shown here.');
    await page.getByRole('button', { name: msg('en', 'report.submit') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      msg('en', 'report.thanks.title'),
    );
  });

  test('an unpublished or unknown record is a 404', async ({ page }) => {
    const response = await page.goto('/en/programs/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('en', 'notFound.title'));
  });
});

test.describe('Caching and budgets', () => {
  test('data pages are cached by data version; compare and report are not', async ({ request }) => {
    const first = await request.get('/en/scholarships?coverage=partial');
    expect(['hit', 'miss']).toContain(first.headers()['x-clavis-cache']);
    expect(first.headers()['cache-control']).toBe('no-cache');
    const second = await request.get('/en/scholarships?coverage=partial&utm_source=x');
    expect(second.headers()['x-clavis-cache']).toBe('hit');

    for (const path of ['/en/compare?ids=101', '/en/report?type=program&id=101']) {
      const response = await request.get(path);
      expect(response.headers()['x-clavis-cache']).toBeUndefined();
    }
  });

  for (const path of ['/tk', '/en/search', PROGRAM, SCHOLARSHIP]) {
    test(`${path} stays under 200 KB and 60 KB of JavaScript`, async ({ page }) => {
      const sizes: { url: string; type: string; bytes: number }[] = [];
      page.on('response', async (response) => {
        const type = response.request().resourceType();
        if (type === 'image' || response.status() >= 300) return;
        try {
          // Approximates what Cloudflare sends compressed; fonts are already compressed.
          const body = await response.body();
          const bytes = type === 'font' ? body.length : gzipSync(body).length;
          sizes.push({ url: response.url(), type, bytes });
        } catch {
          // Body unavailable (e.g. aborted): not part of the page.
        }
      });
      await page.goto(path, { waitUntil: 'networkidle' });
      // Islands load on visibility; scroll so they count too.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForLoadState('networkidle');

      const total = sizes.reduce((sum, s) => sum + s.bytes, 0);
      const js = sizes.filter((s) => s.type === 'script').reduce((sum, s) => sum + s.bytes, 0);
      test.info().annotations.push({
        type: 'weight',
        description: `${path}: ${(total / 1024).toFixed(1)} KB total, ${(js / 1024).toFixed(1)} KB JS`,
      });
      expect(total, JSON.stringify(sizes, null, 1)).toBeLessThan(200 * 1024);
      expect(js).toBeLessThan(60 * 1024);
    });
  }
});

test('every public record page links its source and shows when it was checked', async ({
  page,
}) => {
  for (const path of [
    PROGRAM,
    '/en/universities/demo-university-1',
    '/en/colleges/demo-pathway-college-1',
    SCHOLARSHIP,
  ]) {
    await page.goto(path);
    await expect(page.getByText(/^Last checked /).first(), path).toBeVisible();
    await expect(
      page.getByRole('link', { name: literal(msg('en', 'common.source')) }).first(),
      path,
    ).toBeVisible();
  }
});
