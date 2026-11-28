import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

/** Collects `--name: #hex` declarations from one CSS block. */
function colours(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    found[match[1] as string] = (match[2] as string).toLowerCase();
  }
  return found;
}

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Missing ${selector} in tokens.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

const light = colours(block(':root {'));
const darkByAttribute = { ...light, ...colours(block(":root[data-theme='dark']")) };
const darkBySystem = { ...light, ...colours(block(":root:not([data-theme='light'])")) };

// Values from SPEC.md, "UI: tokens, components and layouts".
const SPEC = {
  '--surface': ['#faf3e3', '#111b16'],
  '--surface-raised': ['#ffffff', '#1a2721'],
  '--ink': ['#16261d', '#f3ecdd'],
  '--ink-muted': ['#4a5a50', '#b4bfb7'],
  '--brand': ['#234f3b', '#7fbf98'],
  '--on-brand': ['#faf3e3', '#0f1a14'],
  '--brand-soft': ['#e3eddd', '#20382b'],
  '--accent': ['#e4775a', '#f0906f'],
  '--on-accent': ['#16261d', '#16261d'],
  '--border': ['#dcd4c2', '#2e3d35'],
  '--danger': ['#b3261e', '#f2b8b5'],
} as const;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour / background pairs the UI uses.
const TEXT_PAIRS: [text: string, background: string][] = [
  ['--ink', '--surface'],
  ['--ink', '--surface-raised'],
  ['--ink', '--brand-soft'],
  ['--ink-muted', '--surface'],
  ['--ink-muted', '--surface-raised'],
  ['--ink-muted', '--brand-soft'],
  ['--brand', '--surface'],
  ['--brand', '--surface-raised'],
  ['--brand', '--brand-soft'],
  ['--on-brand', '--brand'],
  ['--on-accent', '--accent'],
  ['--danger', '--surface'],
  ['--danger', '--surface-raised'],
  // The "Delete my account" button.
  ['--on-brand', '--danger'],
];

describe('design tokens', () => {
  it('match the spec in light and dark', () => {
    for (const [token, [lightValue, darkValue]] of Object.entries(SPEC)) {
      expect(light[token], `${token} light`).toBe(lightValue);
      expect(darkByAttribute[token], `${token} dark`).toBe(darkValue);
    }
  });

  it('give the same dark theme for the system setting and the data-theme switch', () => {
    expect(darkBySystem).toEqual(darkByAttribute);
  });

  it('keep the logo flag coral and the pages leaf green in both themes', () => {
    expect(light['--logo-flag']).toBe('#e4775a');
    expect(darkByAttribute['--logo-flag']).toBe('#e4775a');
    expect(darkByAttribute['--logo-leaf']).toBe(light['--logo-leaf']);
    expect(light['--logo-ink']).toBe('#234f3b');
    expect(darkByAttribute['--logo-ink']).toBe('#faf3e3');
  });

  for (const [name, theme] of [
    ['light', light],
    ['dark', darkByAttribute],
  ] as const) {
    it.each(TEXT_PAIRS)(`${name}: %s on %s reaches 4.5:1`, (text, background) => {
      const ratio = contrast(theme[text] as string, theme[background] as string);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
