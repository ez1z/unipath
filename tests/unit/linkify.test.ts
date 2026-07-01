import { describe, it, expect } from 'vitest';
import { linkify, toHref } from '@/lib/discussions/linkify';

describe('linkify', () => {
  it('returns a single text segment when there is no URL', () => {
    expect(linkify('just plain text')).toEqual([{ type: 'text', value: 'just plain text' }]);
  });

  it('splits a URL out of surrounding text', () => {
    expect(linkify('see https://a.com now')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://a.com' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('keeps trailing punctuation in the text segment', () => {
    expect(linkify('go to https://a.com.')).toEqual([
      { type: 'text', value: 'go to ' },
      { type: 'url', value: 'https://a.com' },
      { type: 'text', value: '.' },
    ]);
  });

  it('handles bare www. URLs and multiple links', () => {
    expect(linkify('www.a.com and https://b.org')).toEqual([
      { type: 'url', value: 'www.a.com' },
      { type: 'text', value: ' and ' },
      { type: 'url', value: 'https://b.org' },
    ]);
  });

  it('toHref prefixes bare www URLs with https', () => {
    expect(toHref('www.a.com')).toBe('https://www.a.com');
    expect(toHref('https://a.com')).toBe('https://a.com');
  });
});
