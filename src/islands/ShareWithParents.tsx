/**
 * The link to a parent page, ready to pass on. Without JavaScript it is a
 * read-only text field to copy by hand. With JavaScript: a Copy button, and a
 * Share button that uses Telegram's share sheet inside the Mini App, else the
 * phone's own share sheet where there is one.
 */
import '../styles/share.css';
import { useState } from 'react';
import { inTelegramApp, shareInTelegram } from '../lib/telegram-app';
import { useHydrated } from './hydrated';

export interface ShareWithParentsProps {
  url: string;
  /** Visible label of the text field. */
  label: string;
  /** Message sent with the link, e.g. "My applications on Clavis". */
  message: string;
  labels: { copy: string; copied: string; share: string };
}

export default function ShareWithParents({ url, label, message, labels }: ShareWithParentsProps) {
  const [canShare, setCanShare] = useState(false);
  const enhanced = useHydrated(() =>
    setCanShare(inTelegramApp() || typeof navigator.share === 'function'),
  );
  const [copied, setCopied] = useState(false);
  const id = `share-${url.slice(-8)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  }

  async function share() {
    if (shareInTelegram(url, message)) return;
    try {
      await navigator.share({ url, text: message });
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  return (
    <div class="share-link">
      <label class="form-label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="input"
        type="url"
        readOnly
        value={url}
        onFocus={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
      />
      {enhanced && (
        <div class="share-actions">
          <button type="button" class="button button-secondary" onClick={() => void copy()}>
            {copied ? labels.copied : labels.copy}
          </button>
          {canShare && (
            <button type="button" class="button" onClick={() => void share()}>
              {labels.share}
            </button>
          )}
          <span class="visually-hidden" role="status">
            {copied ? labels.copied : ''}
          </span>
        </div>
      )}
    </div>
  );
}
