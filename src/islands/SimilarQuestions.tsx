/**
 * Similar questions while a student types a title (SPEC: up to five, FTS5).
 * Watches the plain title field by id; the form works the same without
 * JavaScript, just without suggestions.
 */
import { useEffect, useRef, useState } from 'react';

export interface SimilarQuestionsProps {
  lang: string;
  /** id of the title <input>. */
  inputId: string;
  labels: { title: string; hint: string; answered: string };
}

interface Item {
  title: string;
  lang: string;
  answered: boolean;
  replies: number;
  href: string;
}

const WAIT_MS = 350;
const MIN_LENGTH = 6;

export default function SimilarQuestions({ lang, inputId, labels }: SimilarQuestionsProps) {
  const [items, setItems] = useState<Item[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;
    const lookUp = () => {
      if (timer.current) clearTimeout(timer.current);
      const q = input.value.trim();
      if (q.length < MIN_LENGTH) {
        setItems([]);
        return;
      }
      timer.current = setTimeout(() => {
        const call = ++latest.current;
        const query = new URLSearchParams({ q, lang });
        fetch(`/api/discussions/similar?${query.toString()}`)
          .then((r) => (r.ok ? (r.json() as Promise<{ items: Item[] }>) : { items: [] }))
          .then((data) => {
            // An older, slower answer must not replace a newer one.
            if (call === latest.current) setItems(data.items);
          })
          .catch(() => undefined);
      }, WAIT_MS);
    };
    input.addEventListener('input', lookUp);
    lookUp();
    return () => {
      input.removeEventListener('input', lookUp);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [inputId, lang]);

  return (
    <div class="similar" aria-live="polite">
      {items.length > 0 && (
        <>
          <p class="similar-title">{labels.title}</p>
          <p class="muted-note">{labels.hint}</p>
          <ul class="similar-list">
            {items.map((item) => (
              <li key={item.href}>
                {/* A new tab, so the question being typed isn't lost. */}
                <a href={item.href} lang={item.lang} target="_blank" rel="noopener">
                  {item.title}
                </a>
                {item.answered && <span class="muted-note"> · {labels.answered}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
