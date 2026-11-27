import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const LANGS = ['tk', 'ru', 'en'] as const;
type Lang = (typeof LANGS)[number];

const messages = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    JSON.parse(
      readFileSync(new URL(`../../src/i18n/${lang}.json`, import.meta.url), 'utf8'),
    ) as Record<string, string>,
  ]),
) as Record<Lang, Record<string, string>>;

/** A UI string from the message files; fails the test if the key is missing. */
function msg(lang: Lang, key: string): string {
  const text = messages[lang][key];
  if (text === undefined) throw new Error(`Missing message ${lang}:${key}`);
  return text;
}

const SURFACE = { light: 'rgb(250, 243, 227)', dark: 'rgb(17, 27, 22)' } as const;
const INK = { light: 'rgb(22, 38, 29)', dark: 'rgb(243, 236, 221)' } as const;

const isPhone = (projectName: string) => projectName === 'phone';

/** The nav that is visible at this width: header nav on desktop, bottom bar on phone. */
function mainNav(page: Page, projectName: string) {
  return page.locator(isPhone(projectName) ? '.bottom-bar' : '.header-nav');
}

async function hasNoHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

test.describe('Home in every language and theme', () => {
  for (const lang of LANGS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${lang} ${theme}`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: theme });
        const response = await page.goto(`/${lang}`);
        expect(response?.status()).toBe(200);

        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          msg(lang, 'home.headline'),
        );
        await expect(page).toHaveTitle(msg(lang, 'home.title'));

        const colours = await page.evaluate(() => {
          const style = getComputedStyle(document.body);
          return { background: style.backgroundColor, text: style.color };
        });
        expect(colours.background).toBe(SURFACE[theme]);
        expect(colours.text).toBe(INK[theme]);

        // The five tabs, translated, in the nav for this width.
        const nav = mainNav(page, testInfo.project.name);
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link')).toHaveText(
          ['nav.home', 'nav.universities', 'nav.scholarships', 'nav.discussions', 'nav.my'].map(
            (key) => msg(lang, key),
          ),
        );
        await expect(nav.getByRole('link', { name: msg(lang, 'nav.home') })).toHaveAttribute(
          'aria-current',
          'page',
        );

        expect(await hasNoHorizontalOverflow(page)).toBe(true);

        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: testInfo.outputPath(`home-${lang}-${theme}.png`),
          fullPage: true,
        });
        await page.screenshot({
          path: `test-results/screens/${testInfo.project.name}-${lang}-${theme}.png`,
        });
      });
    }
  }
});

test.describe('App shell layout', () => {
  test('shows the right navigation for the width', async ({ page }, testInfo) => {
    await page.goto('/en');
    const headerNav = page.locator('.header-nav');
    const bottomBar = page.locator('.bottom-bar');
    const signIn = page.getByRole('link', { name: 'Sign in' });
    if (isPhone(testInfo.project.name)) {
      await expect(bottomBar).toBeVisible();
      await expect(headerNav).toBeHidden();
      await expect(signIn).toBeHidden();
      // The bar stays pinned to the bottom of the screen.
      const box = await bottomBar.boundingBox();
      const viewport = page.viewportSize();
      expect(box && viewport && Math.round(box.y + box.height)).toBe(viewport?.height);
    } else {
      await expect(headerNav).toBeVisible();
      await expect(signIn).toBeVisible();
      await expect(bottomBar).toBeHidden();
    }
    await expect(page.getByRole('link', { name: 'Clavis home' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Language' })).toBeVisible();
  });

  test('labels and controls are never clipped or squeezed, at the narrowest width too', async ({
    page,
  }, testInfo) => {
    const width = isPhone(testInfo.project.name) ? 360 : 1024;
    await page.setViewportSize({ width, height: 800 });
    for (const lang of LANGS) {
      await page.goto(`/${lang}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await hasNoHorizontalOverflow(page), `${lang} at ${width}px`).toBe(true);

      const problems = await page.evaluate(() => {
        const found: string[] = [];
        // At the default text size the bottom bar fits without scrolling.
        const bar = document.querySelector<HTMLElement>('.bottom-bar ul');
        if (bar && bar.offsetParent !== null && bar.scrollWidth > bar.clientWidth) {
          found.push(`bottom bar needs ${bar.scrollWidth}px but has ${bar.clientWidth}px`);
        }
        const controls = document.querySelectorAll<HTMLElement>('header a, .bottom-bar a');
        for (const el of controls) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || el.offsetParent === null) continue;
          const rect = el.getBoundingClientRect();
          const name = el.textContent?.trim() ?? el.getAttribute('aria-label') ?? '';
          if (rect.width < 44 || rect.height < 44) {
            found.push(`${name}: ${rect.width}x${rect.height} is under 44px`);
          }
          if (el.scrollWidth > el.clientWidth + 1) found.push(`${name}: text overflows`);

          // No word may be split across two lines ("Universitie / s").
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.parentElement?.closest('.visually-hidden')) continue;
            const text = node.textContent ?? '';
            for (const match of text.matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
              if (lines.size > 1) found.push(`${name}: "${match[0]}" is split across lines`);
            }
          }
        }
        return found;
      });
      expect(problems, `${lang} at ${width}px`).toEqual([]);
    }
  });
});

test.describe('Language routing', () => {
  test('/ opens Turkmen on a first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tk$/);
  });

  test('/ opens the saved language', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'clavis_lang', value: 'ru', url: baseURL as string }]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/ru$/);
  });

  test('an invalid saved language falls back to Turkmen', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'clavis_lang', value: 'xx', url: baseURL as string }]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/tk$/);
  });

  test('the language switch opens the same page and remembers the choice', async ({ page }) => {
    await page.goto('/tk');
    await page
      .getByRole('navigation', { name: msg('tk', 'lang.label') })
      .getByRole('link', { name: 'EN – English' })
      .click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
  });

  test('every page lists hreflang alternates for the three languages', async ({ page }) => {
    await page.goto('/ru');
    const alternates = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) =>
        links.map((link) => [
          link.getAttribute('hreflang'),
          new URL(link.getAttribute('href') ?? '').pathname,
        ]),
      );
    expect(alternates).toEqual([
      ['tk', '/tk'],
      ['ru', '/ru'],
      ['en', '/en'],
      ['x-default', '/tk'],
    ]);
  });

  test('an unknown language prefix is a 404', async ({ page }) => {
    const response = await page.goto('/de');
    expect(response?.status()).toBe(404);
  });
});

test.describe('Without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Home renders fully as plain HTML', async ({ page }, testInfo) => {
    await page.goto('/ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('ru', 'home.headline'));
    await expect(mainNav(page, testInfo.project.name).getByRole('link')).toHaveCount(5);
    // The language switch is plain links.
    await page
      .getByRole('navigation', { name: msg('ru', 'lang.label') })
      .getByRole('link', { name: 'TK – Türkmençe' })
      .click();
    await expect(page).toHaveURL(/\/tk$/);
  });
});

test.describe('Keyboard', () => {
  test('the first Tab shows a skip link that moves focus to the content', async ({ page }) => {
    await page.goto('/en');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('focused links show a visible ring in the brand colour', async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), 'Keyboard focus is checked on desktop.');
    await page.goto('/en');
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // logo
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor };
    });
    expect(outline).toEqual({ style: 'solid', width: '3px', colour: 'rgb(35, 79, 59)' });
  });
});
