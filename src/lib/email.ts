/**
 * The only two emails Clavis sends: sign-in codes and deadline reminders (M4).
 *
 * - Production: Cloudflare Email, sent from the Worker through a `send_email`
 *   binding (set up in DEPLOY.md).
 * - Local: printed to the console, and kept for a few minutes in a local KV
 *   "dev mailbox" so end-to-end tests can read the code. Nothing is sent.
 */
import { getTranslations } from '../i18n/index.ts';
import type { Lang } from '../i18n/config.ts';

export type MailKind = 'sign-in-code' | 'reminder';

export interface Mail {
  kind: MailKind;
  to: string;
  subject: string;
  text: string;
  /** The sign-in code, kept separately so the dev mailbox can hand it to tests. */
  code?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** The part of Cloudflare Email's `send_email` binding Clavis uses. */
export interface SendEmailBinding {
  send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export class MailRefused extends Error {}

/** Addresses on reserved domains (Telegram users' placeholders) never get mail. */
function assertDeliverable(to: string) {
  if (/\.(invalid|example|test|localhost)$/i.test(to.trim())) {
    throw new MailRefused(`Not a deliverable address: ${to}`);
  }
}

export function cloudflareMailer(binding: SendEmailBinding, from: string): Mailer {
  return {
    async send(mail) {
      assertDeliverable(mail.to);
      await binding.send({ from, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}

/** Local mailbox in KV, read only by tests through /api/dev/mailbox. */
export const DEV_MAILBOX_PREFIX = 'dev-mailbox:';
const DEV_MAILBOX_TTL_SECONDS = 600;

export interface DevMailboxEntry {
  kind: MailKind;
  subject: string;
  text: string;
  code: string | null;
  at: number;
}

export function consoleMailer(mailbox?: KVNamespace | null): Mailer {
  return {
    async send(mail) {
      // Placeholders are skipped here too, so local behaviour matches production.
      if (/\.invalid$/i.test(mail.to)) return;
      console.info(
        `[clavis mail] ${mail.kind} to ${mail.to}: ${mail.subject}\n${mail.text}\n[end mail]`,
      );
      if (!mailbox) return;
      const entry: DevMailboxEntry = {
        kind: mail.kind,
        subject: mail.subject,
        text: mail.text,
        code: mail.code ?? null,
        at: Date.now(),
      };
      await mailbox.put(DEV_MAILBOX_PREFIX + mail.to.toLowerCase(), JSON.stringify(entry), {
        expirationTtl: DEV_MAILBOX_TTL_SECONDS,
      });
    },
  };
}

export function signInCodeMail(lang: Lang, to: string, code: string): Mail {
  const t = getTranslations(lang);
  return {
    kind: 'sign-in-code',
    to,
    code,
    subject: t('email.code.subject', { code }),
    text: [
      t('email.code.body', { code }),
      '',
      t('email.code.expiry'),
      t('email.code.ignore'),
      '',
      'Clavis',
    ].join('\n'),
  };
}
