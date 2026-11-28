/**
 * Eligibility checklist on a scholarship page. Without JavaScript it is a plain
 * list of conditions; once hydrated, ticks produce "Looks like a fit" or
 * "Missing: …". Nothing is stored or sent.
 */
import { tkList } from '../lib/tk-intl';
import { useState } from 'react';

export interface EligibilityChecklistProps {
  lang: string;
  items: string[];
  hint: string;
  fitLabel: string;
  /** "Missing: {items}" */
  missingLabel: string;
  /** Marks the items as English text shown in another language ("Not translated yet"). */
  fallbackLabel: string | null;
}

export default function EligibilityChecklist(props: EligibilityChecklistProps) {
  const { lang, items, hint, fitLabel, missingLabel, fallbackLabel } = props;
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false));
  const [touched, setTouched] = useState(false);

  const missing = items.filter((_, i) => !ticked[i]);
  const status = !touched
    ? ''
    : missing.length === 0
      ? fitLabel
      : missingLabel.replace(
          '{items}',
          lang === 'tk'
            ? tkList(missing)
            : new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(missing),
        );

  return (
    <div class="checklist">
      <p class="hint">
        {hint}
        {fallbackLabel && <span class="not-translated"> {fallbackLabel}</span>}
      </p>
      <ul lang={fallbackLabel ? 'en' : undefined}>
        {items.map((item, i) => (
          <li key={item}>
            <label>
              <input
                type="checkbox"
                checked={ticked[i] ?? false}
                onChange={(event) => {
                  const next = [...ticked];
                  next[i] = event.currentTarget.checked;
                  setTicked(next);
                  setTouched(true);
                }}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p class={`status ${missing.length === 0 ? 'fit' : ''}`} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
