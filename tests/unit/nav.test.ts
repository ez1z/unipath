import { describe, expect, it } from 'vitest';
import { activeSection, navItems } from '../../src/lib/nav';

describe('navItems', () => {
  it('lists the five tabs in order, under the page language', () => {
    const items = navItems('ru');
    expect(items.map((item) => item.section)).toEqual([
      'home',
      'universities',
      'scholarships',
      'discussions',
      'my',
    ]);
    expect(items.every((item) => item.href === '/ru' || item.href.startsWith('/ru/'))).toBe(true);
  });
});

describe('activeSection', () => {
  it.each([
    ['/tk', 'home'],
    ['/tk/', 'home'],
    ['/en/search', 'universities'],
    ['/en/universities/demo-university-1', 'universities'],
    ['/en/programs/demo-program', 'universities'],
    ['/ru/scholarships', 'scholarships'],
    ['/ru/scholarships/demo-scholarship', 'scholarships'],
    ['/tk/discussions/tests', 'discussions'],
    ['/tk/my', 'my'],
    ['/tk/my/tracker/12', 'my'],
  ])('%s -> %s', (path, section) => {
    expect(activeSection(path)).toBe(section);
  });

  it('marks nothing on other pages', () => {
    expect(activeSection('/en/about')).toBeNull();
    expect(activeSection('/en/mystery')).toBeNull();
  });
});
