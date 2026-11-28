/**
 * Save on a program, university or scholarship page.
 *
 * Without JavaScript it is a form posting to /api/save: signed out, that sends
 * the student to sign in with the save as the pending action, and back. With
 * JavaScript it asks /api/save whether this is saved, toggles in place, and
 * when signed out opens the sign-in sheet (loaded only then), saving right after.
 */
import '../styles/save.css';
import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'react';
import { copyQuizToProfile } from './account-client';
import type { SignInSheetProps } from './SignInSheet';

const SignInSheet = lazy(() => import('./SignInSheet'));

export interface SaveButtonProps {
  lang: string;
  type: 'program' | 'university' | 'scholarship';
  id: number;
  /** This page's path, to come back to. */
  back: string;
  labels: { save: string; saved: string; error: string };
  sheet: Omit<SignInSheetProps, 'onClose' | 'onSignedIn'>;
}

export default function SaveButton(props: SaveButtonProps) {
  const { lang, type, id, back, labels, sheet } = props;
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/save?type=${type}&id=${id}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ signedIn: boolean; saved: boolean }>) : null))
      .then((status) => {
        if (!status) return;
        setSignedIn(status.signedIn);
        setSaved(status.saved);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [type, id]);

  async function save(next: boolean): Promise<'ok' | 'auth' | 'error'> {
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, saved: next, lang }),
      });
      if (response.status === 401) return 'auth';
      return response.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  async function onSubmit(event: Event) {
    event.preventDefault();
    if (busy) return;
    setError(false);
    if (signedIn === false) {
      setSheetOpen(true);
      return;
    }
    setBusy(true);
    const result = await save(!saved);
    setBusy(false);
    if (result === 'auth') {
      setSignedIn(false);
      setSheetOpen(true);
    } else if (result === 'ok') {
      setSaved(!saved);
    } else {
      setError(true);
    }
  }

  async function onSignedIn() {
    setSheetOpen(false);
    setSignedIn(true);
    setBusy(true);
    const [result] = await Promise.all([save(true), copyQuizToProfile(lang)]);
    setBusy(false);
    if (result === 'ok') setSaved(true);
    else setError(true);
  }

  return (
    <>
      <form method="post" action="/api/save" class="save-form" onSubmit={onSubmit}>
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="id" value={String(id)} />
        <input type="hidden" name="saved" value={saved ? '0' : '1'} />
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="back" value={back} />
        <button
          type="submit"
          class="button button-secondary save-button"
          data-saved={saved ? 'true' : 'false'}
          aria-busy={busy || undefined}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
          {saved ? labels.saved : labels.save}
        </button>
        {error && (
          <span class="save-error" role="alert">
            {labels.error}
          </span>
        )}
      </form>
      {sheetOpen && (
        <Suspense fallback={null}>
          <SignInSheet
            {...sheet}
            onClose={() => setSheetOpen(false)}
            onSignedIn={() => void onSignedIn()}
          />
        </Suspense>
      )}
    </>
  );
}
