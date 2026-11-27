import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CLAUDE.md: colours only through CSS variables from src/styles/tokens.css.
const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const ALLOWED = new Set(['styles/tokens.css']);
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(astro|css|tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}

describe('raw colours', () => {
  it('appear only in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (ALLOWED.has(rel)) continue;
      const text = readFileSync(file, 'utf8');
      for (const match of [...text.matchAll(HEX), ...text.matchAll(COLOUR_FUNCTION)]) {
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${rel}:${line} ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
