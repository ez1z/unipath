/**
 * Search filters as a plain GET form, server-rendered so it works without
 * JavaScript. Once hydrated:
 * - on phones (bottom sheet) the submit button shows a live result count;
 * - on desktop (left column) changes apply at once.
 * The page builds the groups and labels; this component only renders and listens.
 */
import { useEffect, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  checked: boolean;
  /** Shown in a lighter style after the label, e.g. "Not translated yet". */
  hint?: string;
}

export type FilterGroup =
  | {
      kind: 'checkbox' | 'radio';
      name: string;
      legend: string;
      options: FilterOption[];
    }
  | {
      kind: 'range';
      legend: string;
      min: { name: string; label: string; value: number | null };
      max: { name: string; label: string; value: number | null };
    };

export interface FilterPanelProps {
  id: string;
  action: string;
  /** JSON endpoint answering `{ label }` for a query string, e.g. "/api/search/count?kind=programs&lang=en". */
  countUrl: string;
  /** Values the form keeps but doesn't show: search text, tab, sort. */
  hidden: [name: string, value: string][];
  groups: FilterGroup[];
  applyLabel: string;
  clearLabel: string;
  clearHref: string;
}

const DESKTOP = '(min-width: 1024px)';

/** The form's values without empty fields ("Any", blank cost), so URLs stay short and canonical. */
function formQuery(form: HTMLFormElement): URLSearchParams {
  return new URLSearchParams(
    [...new FormData(form)].filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );
}

export default function FilterPanel(props: FilterPanelProps) {
  const { id, action, countUrl, hidden, groups, applyLabel, clearLabel, clearHref } = props;
  const form = useRef<HTMLFormElement>(null);
  const [label, setLabel] = useState(applyLabel);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (event: Event) => {
    const el = form.current;
    if (!el) return;
    const isNumber = event.target instanceof HTMLInputElement && event.target.type === 'number';
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        if (window.matchMedia(DESKTOP).matches) {
          el.requestSubmit();
          return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const query = formQuery(el);
        fetch(`${countUrl}&${query.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? (res.json() as Promise<{ label?: string }>) : null))
          .then((data) => {
            if (data?.label) setLabel(data.label);
          })
          .catch(() => {
            // Offline or aborted: keep the plain "Show results" label.
          });
      },
      isNumber ? 600 : 150,
    );
  };

  return (
    <form
      ref={form}
      id={id}
      class="filter-form"
      method="get"
      action={action}
      onChange={onChange}
      onSubmit={(event) => {
        // Same GET as without JavaScript, minus the empty fields.
        event.preventDefault();
        const query = formQuery(event.currentTarget).toString();
        window.location.assign(query ? `${action}?${query}` : action);
      }}
      onInput={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'number')
          onChange(event);
      }}
    >
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {groups.map((group) => (
        <fieldset key={group.legend} class="filter-group">
          <legend>{group.legend}</legend>
          {group.kind === 'range' ? (
            <div class="range">
              {[group.min, group.max].map((end) => (
                <label key={end.name} class="number">
                  <span>{end.label}</span>
                  <input
                    type="number"
                    name={end.name}
                    min={0}
                    step={500}
                    inputMode="numeric"
                    defaultValue={end.value === null ? '' : String(end.value)}
                  />
                </label>
              ))}
            </div>
          ) : (
            group.options.map((option) => (
              <label key={option.value} class="option">
                <input
                  type={group.kind}
                  name={group.name}
                  value={option.value}
                  defaultChecked={option.checked}
                />
                <span>
                  {option.label}
                  {option.hint && <span class="hint"> {option.hint}</span>}
                </span>
              </label>
            ))
          )}
        </fieldset>
      ))}
      <div class="filter-actions">
        <button type="submit" class="button">
          {label}
        </button>
        <a class="button button-quiet" href={clearHref}>
          {clearLabel}
        </a>
      </div>
    </form>
  );
}
