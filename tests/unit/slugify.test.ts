import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/utils/slugify';

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar')).toBe('foo-bar');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugify('foo_bar')).toBe('foo-bar');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('foo   bar')).toBe('foo-bar');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('-hello-')).toBe('hello');
  });

  it('handles an already-slugified string unchanged', () => {
    expect(slugify('already-slugified')).toBe('already-slugified');
  });

  it('produces a valid slug for a university-country combination', () => {
    expect(slugify('MIT-USA')).toBe('mit-usa');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('handles hyphenated words', () => {
    expect(slugify('Need-Based Scholarship')).toBe('need-based-scholarship');
  });
});
