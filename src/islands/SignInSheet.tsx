/**
 * The sign-in sheet: a modal dialog opened by SaveButton (and later by Track
 * and Discussions) when a signed-out student tries something. It says why,
 * then offers Telegram, email code (when email is set up) and Google in that order.
 *
 * Email is done in place: the code is sent and checked through Better Auth's
 * endpoints, then `onSignedIn` finishes the action. Telegram and Google leave
 * the page and come back through /auth/continue, which finishes it there.
 * Loaded on demand, so pages don't pay for it until someone needs it.
 */
import '../styles/save.css';
import { useEffect, useRef, useState } from 'react';

export interface SignInSheetProps {
  lang: string;
  /** Where Telegram's page lives, with next/action; null when Telegram isn't set up. */
  telegramHref: string | null;
  /** The Google form's action; null when Google isn't set up. */
  googleAction: string | null;
  /** False when no email sender is set up (auth/server.ts emailEnabled): no email option. */
  emailCodes: boolean;
  next: string;
  action: string;
  strings: {
    title: string;
    why: string;
    telegram: string;
    email: string;
    google: string;
    or: string;
    emailLabel: string;
    codeLabel: string;
    /** "We sent a 6-digit code to {email}…" */
    codeSent: string;
    verify: string;
    resend: string;
    otherEmail: string;
    close: string;
    privacy: string;
    errorEmail: string;
    errorCode: string;
    errorRate: string;
    errorGeneric: string;
  };
  onClose: () => void;
  onSignedIn: () => void;
}

type Step = 'start' | 'code';
type ErrorKind = 'email' | 'code' | 'rate' | 'generic' | null;

async function postAuth(path: string, lang: string, body: unknown): Promise<Response> {
  return fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Clavis-Lang': lang },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response, fallback: ErrorKind): Promise<ErrorKind> {
  if (response.status === 429) return 'rate';
  try {
    const body = (await response.json()) as { code?: string };
    if (/OTP|ATTEMPT/i.test(body.code ?? '')) return 'code';
    if (/EMAIL/i.test(body.code ?? '')) return 'email';
  } catch {
    // Not JSON.
  }
  return fallback;
}

export default function SignInSheet(props: SignInSheetProps) {
  const { lang, telegramHref, googleAction, emailCodes, next, action, strings: s } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKind>(null);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function sendCode(event?: Event) {
    event?.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await postAuth('/email-otp/send-verification-otp', lang, {
        email: address,
        type: 'sign-in',
      });
      if (response.ok) {
        setStep('code');
        setCode('');
      } else {
        setError(await errorOf(response, 'generic'));
      }
    } catch {
      setError('generic');
    }
    setBusy(false);
  }

  async function verify(event: Event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await postAuth('/sign-in/email-otp', lang, {
        email: email.trim(),
        otp: code.trim(),
      });
      if (response.ok) {
        props.onSignedIn();
        return;
      }
      setError(await errorOf(response, 'code'));
    } catch {
      setError('generic');
    }
    setBusy(false);
  }

  const errorText = {
    email: s.errorEmail,
    code: s.errorCode,
    rate: s.errorRate,
    generic: s.errorGeneric,
  };

  return (
    <dialog
      ref={dialog}
      class="sign-in-sheet"
      aria-labelledby="sign-in-sheet-title"
      onClose={props.onClose}
      onCancel={props.onClose}
    >
      <div class="sheet-head">
        <h2 id="sign-in-sheet-title" class="text-title">
          {s.title}
        </h2>
        <button type="button" class="button button-quiet sheet-close" onClick={props.onClose}>
          {s.close}
        </button>
      </div>

      {step === 'start' ? (
        <>
          <p class="text-muted">{s.why}</p>
          {error && (
            <p class="form-error" role="alert">
              {errorText[error]}
            </p>
          )}
          {telegramHref && (
            <a class="button sheet-method" href={telegramHref}>
              {s.telegram}
            </a>
          )}
          {emailCodes && telegramHref && (
            <p class="sheet-or" aria-hidden="true">
              {s.or}
            </p>
          )}
          {emailCodes && (
            <form class="form" noValidate onSubmit={(e) => void sendCode(e)}>
              <div class="field">
                <label for="sheet-email">{s.emailLabel}</label>
                <input
                  id="sheet-email"
                  class="input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  aria-invalid={error === 'email' || undefined}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                />
              </div>
              <button
                type="submit"
                class="button button-secondary sheet-method"
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {s.email}
              </button>
            </form>
          )}
          {googleAction && (
            <>
              {(telegramHref || emailCodes) && (
                <p class="sheet-or" aria-hidden="true">
                  {s.or}
                </p>
              )}
              <form method="post" action={googleAction}>
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="action" value={action} />
                <button type="submit" class="button button-secondary sheet-method">
                  {s.google}
                </button>
              </form>
            </>
          )}
          <p class="muted-note">{s.privacy}</p>
        </>
      ) : (
        <>
          <p role="status">{s.codeSent.replace('{email}', email.trim())}</p>
          {error && (
            <p class="form-error" role="alert">
              {errorText[error]}
            </p>
          )}
          <form class="form" noValidate onSubmit={(e) => void verify(e)}>
            <div class="field">
              <label for="sheet-code">{s.codeLabel}</label>
              <input
                ref={codeInput}
                id="sheet-code"
                class="input sheet-code"
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                aria-invalid={error === 'code' || undefined}
                onInput={(e) => setCode(e.currentTarget.value)}
              />
            </div>
            <button
              type="submit"
              class="button sheet-method"
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {s.verify}
            </button>
          </form>
          <div class="sheet-row">
            <button
              type="button"
              class="button button-quiet"
              disabled={busy}
              onClick={() => void sendCode()}
            >
              {s.resend}
            </button>
            <button
              type="button"
              class="button button-quiet"
              onClick={() => {
                setStep('start');
                setError(null);
              }}
            >
              {s.otherEmail}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
