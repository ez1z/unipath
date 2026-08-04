import { describe, it, expect } from 'vitest';
import { mergeDocs, parseGuestDocs, hasLocalDocs } from '@/lib/docs/guest-store';
import { EMPTY_DIFF, type DocsDiff, type DocsDiffMap } from '@/lib/docs/types';

const UNI_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UNI_B = '5c1e9a72-8b30-4d6e-9f21-77a1b4c5d6e2';

const diff = (over: Partial<DocsDiff> = {}): DocsDiff => ({ ...EMPTY_DIFF, ...over });

describe('parseGuestDocs', () => {
  it('returns nothing for missing storage', () => {
    expect(parseGuestDocs(null)).toEqual({});
  });

  it('returns nothing rather than throwing on corrupt JSON', () => {
    expect(parseGuestDocs('{not json')).toEqual({});
  });

  it('rejects a stored array or scalar, which cannot be a diff map', () => {
    expect(parseGuestDocs('[]')).toEqual({});
    expect(parseGuestDocs('"nope"')).toEqual({});
  });

  it('reads back what it could have written', () => {
    const raw = JSON.stringify({ [UNI_A]: diff({ checked: ['d:default_sat'] }) });
    expect(parseGuestDocs(raw)[UNI_A].checked).toEqual(['d:default_sat']);
  });

  /**
   * One unparseable university must not cost the student the other forty-nine —
   * the same tolerance stored column layouts get.
   */
  it('drops only the entries that fail validation', () => {
    const raw = JSON.stringify({
      [UNI_A]: { checked: 'not-an-array' },
      [UNI_B]: diff({ checked: ['d:default_toefl'] }),
    });

    const parsed = parseGuestDocs(raw);
    expect(parsed[UNI_A]).toBeUndefined();
    expect(parsed[UNI_B].checked).toEqual(['d:default_toefl']);
  });

  it('discards empty diffs, which carry no information', () => {
    expect(parseGuestDocs(JSON.stringify({ [UNI_A]: EMPTY_DIFF }))).toEqual({});
  });
});

describe('hasLocalDocs', () => {
  it('is false when nothing is stored', () => {
    expect(hasLocalDocs({})).toBe(false);
  });

  it('is true once any university has progress', () => {
    expect(hasLocalDocs({ [UNI_A]: diff({ checked: ['d:default_sat'] }) })).toBe(true);
  });
});

describe('mergeDocs — the account wins', () => {
  it('keeps the server diff for a university present in both', () => {
    const local: DocsDiffMap = { [UNI_A]: diff({ checked: ['d:default_sat'] }) };
    const server: DocsDiffMap = { [UNI_A]: diff({ checked: ['d:default_toefl'] }) };

    expect(mergeDocs(local, server)[UNI_A].checked).toEqual(['d:default_toefl']);
  });

  it('adopts universities the account has never seen', () => {
    const local: DocsDiffMap = { [UNI_B]: diff({ checked: ['d:default_sat'] }) };
    const server: DocsDiffMap = { [UNI_A]: diff({ removed: ['d:default_sat'] }) };

    const merged = mergeDocs(local, server);
    expect(Object.keys(merged).sort()).toEqual([UNI_A, UNI_B].sort());
    expect(merged[UNI_B].checked).toEqual(['d:default_sat']);
  });

  it('is a no-op when the guest has nothing', () => {
    const server: DocsDiffMap = { [UNI_A]: diff({ checked: ['d:default_sat'] }) };
    expect(mergeDocs({}, server)).toEqual(server);
  });

  /**
   * A single-university page seeds the map with that university whether or not
   * the account has progress for it. If a present-but-empty diff counted as
   * "the account has this one", a guest who ticked boxes on that page and then
   * signed in from it would lose every tick.
   */
  it('adopts over a present-but-empty server diff, which means no progress', () => {
    const local: DocsDiffMap = { [UNI_A]: diff({ checked: ['d:default_sat'] }) };
    const server: DocsDiffMap = { [UNI_A]: diff() };

    expect(mergeDocs(local, server)[UNI_A].checked).toEqual(['d:default_sat']);
  });

  it('still refuses to overwrite a server diff that holds only a deletion', () => {
    const local: DocsDiffMap = { [UNI_A]: diff({ checked: ['d:default_sat'] }) };
    const server: DocsDiffMap = { [UNI_A]: diff({ removed: ['d:default_toefl'] }) };

    expect(mergeDocs(local, server)[UNI_A]).toEqual(server[UNI_A]);
  });

  it('does not mutate either input', () => {
    const local: DocsDiffMap = { [UNI_B]: diff() };
    const server: DocsDiffMap = { [UNI_A]: diff() };

    mergeDocs(local, server);
    expect(Object.keys(local)).toEqual([UNI_B]);
    expect(Object.keys(server)).toEqual([UNI_A]);
  });
});
