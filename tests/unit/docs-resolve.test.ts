import { describe, it, expect } from 'vitest';
import {
  addDoc,
  docsProgress,
  removeDoc,
  resolveDocs,
  templateItems,
  toggleDoc,
} from '@/lib/docs/resolve';
import { DEFAULT_DOC_KEYS, EMPTY_DIFF, MAX_CUSTOM_DOCS, type DocsDiff } from '@/lib/docs/types';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import tk from '@/messages/tk.json';

/** Stands in for next-intl's `t` over the `checklist` namespace. */
const translator = (messages: Record<string, string>) => (key: string) => messages[key] ?? key;

const t = translator(en.checklist as Record<string, string>);

const withRequirements = (docs: unknown) => ({ document_requirements: docs });

describe('templateItems — where the checklist comes from', () => {
  it('uses the six built-ins when the university publishes no requirements', () => {
    expect(templateItems({}, t).map((i) => i.id)).toEqual(
      DEFAULT_DOC_KEYS.map((k) => `d:${k}`),
    );
  });

  it('falls back to the built-ins for null, a non-array, and an empty array alike', () => {
    for (const value of [null, undefined, withRequirements('passport'), withRequirements([])]) {
      expect(templateItems(value as Record<string, unknown>, t)).toHaveLength(
        DEFAULT_DOC_KEYS.length,
      );
    }
  });

  it("prefers the university's own requirements when it has them", () => {
    const items = templateItems(withRequirements(['Passport copy', 'YÖS result']), t);
    expect(items).toEqual([
      { id: 't:Passport copy', name: 'Passport copy' },
      { id: 't:YÖS result', name: 'YÖS result' },
    ]);
  });

  it('trims names and drops blank or non-string entries', () => {
    const items = templateItems(withRequirements(['  Passport  ', '', 42, null, 'Transcript']), t);
    expect(items.map((i) => i.name)).toEqual(['Passport', 'Transcript']);
  });

  it('deduplicates requirements that differ only by surrounding space', () => {
    expect(templateItems(withRequirements(['Passport', 'Passport ']), t)).toHaveLength(1);
  });
});

describe('resolveDocs — template plus the student’s changes', () => {
  it('returns an untouched, unticked template for an empty diff', () => {
    const items = resolveDocs({}, EMPTY_DIFF, t);
    expect(items).toHaveLength(DEFAULT_DOC_KEYS.length);
    expect(items.every((i) => !i.checked && i.source === 'template')).toBe(true);
  });

  it('marks only the ids named in `checked`', () => {
    const items = resolveDocs({}, { ...EMPTY_DIFF, checked: ['d:default_toefl'] }, t);
    expect(items.find((i) => i.id === 'd:default_toefl')?.checked).toBe(true);
    expect(items.filter((i) => i.checked)).toHaveLength(1);
  });

  it('hides template items the student removed', () => {
    const items = resolveDocs({}, { ...EMPTY_DIFF, removed: ['d:default_sat'] }, t);
    expect(items.map((i) => i.id)).not.toContain('d:default_sat');
    expect(items).toHaveLength(DEFAULT_DOC_KEYS.length - 1);
  });

  it('appends custom items after the template, in their stored order', () => {
    const diff: DocsDiff = {
      checked: ['c:2'],
      removed: [],
      custom: [
        { id: 'c:1', name: 'Bank statement' },
        { id: 'c:2', name: 'Medical certificate' },
      ],
    };
    const items = resolveDocs({}, diff, t);
    expect(items.slice(-2).map((i) => i.name)).toEqual(['Bank statement', 'Medical certificate']);
    expect(items.at(-1)?.checked).toBe(true);
    expect(items.at(-1)?.source).toBe('custom');
  });

  it('picks up a requirement added by an admin after the student last ticked something', () => {
    const diff: DocsDiff = { ...EMPTY_DIFF, checked: ['t:Passport'] };
    const items = resolveDocs(withRequirements(['Passport', 'New form']), diff, t);
    expect(items.map((i) => i.name)).toEqual(['Passport', 'New form']);
    expect(items.find((i) => i.name === 'Passport')?.checked).toBe(true);
    expect(items.find((i) => i.name === 'New form')?.checked).toBe(false);
  });
});

/**
 * The reason item ids are derived from i18n keys rather than display names. If
 * anyone "simplifies" them back to the translated text, this fails loudly —
 * every student browsing in Turkmen or Russian would silently lose their ticks.
 */
describe('resolveDocs — ids survive a locale switch', () => {
  it('resolves the same checked ids in all three locales', () => {
    const diff: DocsDiff = { ...EMPTY_DIFF, checked: ['d:default_toefl', 'd:default_passport'] };

    const checkedIds = [en, ru, tk].map((messages) =>
      resolveDocs({}, diff, translator(messages.checklist as Record<string, string>))
        .filter((i) => i.checked)
        .map((i) => i.id),
    );

    expect(checkedIds[0]).toEqual(['d:default_passport', 'd:default_toefl']);
    expect(checkedIds[1]).toEqual(checkedIds[0]);
    expect(checkedIds[2]).toEqual(checkedIds[0]);
  });

  it('still shows translated names even though the ids never change', () => {
    const names = (messages: typeof en) =>
      resolveDocs({}, EMPTY_DIFF, translator(messages.checklist as Record<string, string>)).map(
        (i) => i.name,
      );

    expect(names(en)).not.toEqual(names(ru));
    expect(names(en)).not.toEqual(names(tk));
  });
});

describe('toggleDoc', () => {
  it('ticks an item', () => {
    expect(toggleDoc(EMPTY_DIFF, 'd:default_sat', true).checked).toEqual(['d:default_sat']);
  });

  it('unticks an item', () => {
    const diff = { ...EMPTY_DIFF, checked: ['d:default_sat', 'd:default_toefl'] };
    expect(toggleDoc(diff, 'd:default_sat', false).checked).toEqual(['d:default_toefl']);
  });

  it('returns the same object when nothing would change, so no save is triggered', () => {
    const diff = { ...EMPTY_DIFF, checked: ['d:default_sat'] };
    expect(toggleDoc(diff, 'd:default_sat', true)).toBe(diff);
    expect(toggleDoc(diff, 'd:default_toefl', false)).toBe(diff);
  });

  it('never records the same id twice', () => {
    const once = toggleDoc(EMPTY_DIFF, 'd:default_sat', true);
    expect(toggleDoc(once, 'd:default_sat', true).checked).toHaveLength(1);
  });
});

describe('addDoc', () => {
  it('adds a custom item with a c: id', () => {
    const diff = addDoc(EMPTY_DIFF, 'Bank statement');
    expect(diff.custom).toHaveLength(1);
    expect(diff.custom[0].name).toBe('Bank statement');
    expect(diff.custom[0].id.startsWith('c:')).toBe(true);
  });

  it('mints a distinct id per item', () => {
    const diff = addDoc(addDoc(EMPTY_DIFF, 'One'), 'Two');
    expect(diff.custom[0].id).not.toBe(diff.custom[1].id);
  });

  it('trims the name and ignores blank input', () => {
    expect(addDoc(EMPTY_DIFF, '  Spaced  ').custom[0].name).toBe('Spaced');
    expect(addDoc(EMPTY_DIFF, '   ')).toBe(EMPTY_DIFF);
  });

  it('truncates a name past the storage limit rather than rejecting it', () => {
    expect(addDoc(EMPTY_DIFF, 'x'.repeat(500)).custom[0].name).toHaveLength(120);
  });

  it('refuses to exceed the custom item cap', () => {
    let diff = EMPTY_DIFF;
    for (let i = 0; i < MAX_CUSTOM_DOCS; i++) diff = addDoc(diff, `Item ${i}`);
    expect(addDoc(diff, 'One too many')).toBe(diff);
    expect(diff.custom).toHaveLength(MAX_CUSTOM_DOCS);
  });
});

describe('removeDoc', () => {
  it('records a template deletion so the item stays hidden', () => {
    expect(removeDoc(EMPTY_DIFF, 'd:default_sat').removed).toEqual(['d:default_sat']);
  });

  it('drops a custom item outright instead of recording it', () => {
    const added = addDoc(EMPTY_DIFF, 'Bank statement');
    const removed = removeDoc(added, added.custom[0].id);
    expect(removed.custom).toEqual([]);
    expect(removed.removed).toEqual([]);
  });

  it('unticks whatever it removes, so a re-added item is never pre-ticked', () => {
    const diff = toggleDoc(EMPTY_DIFF, 'd:default_sat', true);
    expect(removeDoc(diff, 'd:default_sat').checked).toEqual([]);
  });

  it('does not record the same template deletion twice', () => {
    const once = removeDoc(EMPTY_DIFF, 'd:default_sat');
    expect(removeDoc(once, 'd:default_sat').removed).toHaveLength(1);
  });
});

describe('docsProgress', () => {
  it('counts ticked against total', () => {
    const diff = { ...EMPTY_DIFF, checked: ['d:default_sat', 'd:default_toefl'] };
    expect(docsProgress(resolveDocs({}, diff, t))).toEqual({ total: 6, checked: 2 });
  });

  it('reports zero of zero once every item has been removed', () => {
    const diff = { ...EMPTY_DIFF, removed: DEFAULT_DOC_KEYS.map((k) => `d:${k}`) };
    expect(docsProgress(resolveDocs({}, diff, t))).toEqual({ total: 0, checked: 0 });
  });

  it('gives a real denominator immediately, with nothing stored', () => {
    // The bug that started all this: the list showed "Not started" with a zero
    // denominator until the student opened each university's own page.
    expect(docsProgress(resolveDocs({}, EMPTY_DIFF, t)).total).toBeGreaterThan(0);
  });
});
