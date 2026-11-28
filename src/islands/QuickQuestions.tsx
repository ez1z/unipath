/**
 * "Matches for you" on Home: four quick questions (countries, field, budget,
 * English test), kept in localStorage, and the programs that fit them.
 *
 * Without JavaScript the questions are a plain search form (answers become
 * search filters). With it, the answers are saved on the device (and copied
 * to the profile when signed in) and the matches load in place from the
 * /[lang]/matches fragment, so Home itself stays the same for everyone.
 */
import '../styles/quick-questions.css';
import { useEffect, useRef, useState } from 'react';
import { readQuiz, writeQuiz, type Quiz } from './account-client';

interface Option {
  value: string;
  label: string;
}

export interface QuickQuestionsProps {
  lang: string;
  /** /[lang]/search: where the form goes without JavaScript. */
  searchPath: string;
  /** /[lang]/matches */
  matchesPath: string;
  countries: Option[];
  fields: Option[];
  budgets: Option[];
  tests: Option[];
  strings: {
    intro: string;
    start: string;
    edit: string;
    countries: string;
    field: string;
    anyField: string;
    budget: string;
    anyBudget: string;
    english: string;
    englishNone: string;
    score: string;
    show: string;
    loading: string;
    error: string;
  };
}

function matchParams(quiz: Quiz): URLSearchParams {
  const params = new URLSearchParams();
  for (const code of quiz.countries) params.append('country', code);
  if (quiz.field) params.set('field', quiz.field);
  if (quiz.budgetPerYearUsd !== null) params.set('max_tuition', String(quiz.budgetPerYearUsd));
  if (quiz.englishTest?.name === 'IELTS' && quiz.englishTest.score) {
    params.set('ielts', quiz.englishTest.score);
  }
  return params;
}

function quizFromForm(form: HTMLFormElement): Quiz {
  const data = new FormData(form);
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const budget = Number(text('max_tuition'));
  const test = text('english');
  return {
    countries: data.getAll('country').filter((v): v is string => typeof v === 'string'),
    field: text('field') || null,
    budgetPerYearUsd: text('max_tuition') && Number.isFinite(budget) ? budget : null,
    englishTest:
      test === 'IELTS' || test === 'TOEFL' || test === 'Duolingo'
        ? { name: test, score: text('score') }
        : test === 'none'
          ? { name: 'none', score: '' }
          : null,
  };
}

const sameQuiz = (a: Quiz | null, b: Quiz | null) => JSON.stringify(a) === JSON.stringify(b);

export default function QuickQuestions(props: QuickQuestionsProps) {
  const { lang, searchPath, matchesPath, strings: s } = props;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [signedIn, setSignedIn] = useState(false);
  const request = useRef(0);

  async function loadMatches(next: Quiz) {
    const id = ++request.current;
    setStatus('loading');
    try {
      const response = await fetch(`${matchesPath}?${matchParams(next)}`);
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.text();
      if (id !== request.current) return;
      setHtml(body);
      setStatus('idle');
    } catch {
      if (id === request.current) setStatus('error');
    }
  }

  useEffect(() => {
    // localStorage only exists in the browser, so the answers are read after hydration.
    const local = readQuiz();
    void Promise.resolve().then(() => {
      if (!local) return;
      setQuiz(local);
      void loadMatches(local);
    });
    // Signed in: the device's answers win; with none here, use the profile's.
    fetch(`/api/me?lang=${lang}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ signedIn: boolean; quiz?: Quiz | null }>) : null))
      .then((me) => {
        if (!me?.signedIn) return;
        setSignedIn(true);
        if (local && !sameQuiz(local, me.quiz ?? null)) {
          void saveToProfile(local);
        } else if (!local && me.quiz) {
          writeQuiz(me.quiz);
          setQuiz(me.quiz);
          void loadMatches(me.quiz);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveToProfile(next: Quiz) {
    try {
      await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz: next, lang }),
      });
    } catch {
      // Copied next time.
    }
  }

  function onSubmit(event: Event) {
    event.preventDefault();
    const next = quizFromForm(event.currentTarget as HTMLFormElement);
    writeQuiz(next);
    setQuiz(next);
    setOpen(false);
    void loadMatches(next);
    if (signedIn) void saveToProfile(next);
  }

  const test = quiz?.englishTest?.name ?? '';
  return (
    <div class="quick-questions">
      {!quiz && <p class="text-muted">{s.intro}</p>}
      <details
        class="quiz-details"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary class="button button-secondary">{quiz ? s.edit : s.start}</summary>
        <form method="get" action={searchPath} class="form quiz-form" onSubmit={onSubmit}>
          <input type="hidden" name="level" value="bachelor" />
          <fieldset class="field">
            <legend>{s.countries}</legend>
            <div class="quiz-countries">
              {props.countries.map((c) => (
                <label class="choice" key={c.value}>
                  <input
                    type="checkbox"
                    name="country"
                    value={c.value}
                    defaultChecked={quiz?.countries.includes(c.value) ?? false}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div class="field">
            <label for="quiz-field">{s.field}</label>
            <select id="quiz-field" class="input" name="field" defaultValue={quiz?.field ?? ''}>
              <option value="">{s.anyField}</option>
              {props.fields.map((f) => (
                <option value={f.value} key={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div class="field">
            <label for="quiz-budget">{s.budget}</label>
            <select
              id="quiz-budget"
              class="input"
              name="max_tuition"
              defaultValue={
                quiz?.budgetPerYearUsd === null || !quiz ? '' : String(quiz.budgetPerYearUsd)
              }
            >
              <option value="">{s.anyBudget}</option>
              {props.budgets.map((b) => (
                <option value={b.value} key={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div class="quiz-english">
            <div class="field">
              <label for="quiz-english">{s.english}</label>
              <select id="quiz-english" class="input" name="english" defaultValue={test}>
                <option value="none">{s.englishNone}</option>
                {props.tests.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div class="field">
              <label for="quiz-score">{s.score}</label>
              <input
                id="quiz-score"
                class="input"
                type="text"
                name="score"
                inputMode="decimal"
                maxLength={5}
                defaultValue={quiz?.englishTest?.score ?? ''}
              />
            </div>
          </div>
          <button type="submit" class="button">
            {s.show}
          </button>
        </form>
      </details>
      <div aria-live="polite" aria-busy={status === 'loading' || undefined}>
        {status === 'loading' && <p class="muted-note">{s.loading}</p>}
        {status === 'error' && (
          <p class="form-error" role="alert">
            {s.error}
          </p>
        )}
        {/* Server-rendered by /[lang]/matches on this site (Astro escapes its text). */}
        {html !== null && <div dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </div>
  );
}
