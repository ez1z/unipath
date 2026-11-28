/**
 * Deadline reminders in Telegram, sent by the Clavis bot (SPEC: reminders by
 * the student's channel). These are the only bot messages Clavis sends.
 *
 * - Production: Bot API `sendMessage`, with the bot token from Wrangler secrets.
 * - Local: printed to the console and kept in the dev mailbox, like email.
 *   Nothing reaches Telegram, and the made-up local token is never used.
 *
 * A bot can only write to someone who has opened its chat and pressed Start
 * (or allowed it from the Mini App). Telegram answers 403 otherwise; the
 * reminder is then given back and tried again on the next daily run.
 */
import { DEV_MAILBOX_PREFIX, type DevMailboxEntry } from './email.ts';
import type { TelegramSender } from './reminders.ts';

export const TELEGRAM_API = 'https://api.telegram.org';

export class TelegramSendError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function botSender(botToken: string, fetchFn: typeof fetch = fetch): TelegramSender {
  return async (chatId, text) => {
    if (!/^\d{1,20}$/.test(chatId))
      throw new TelegramSendError(`Not a Telegram user id: ${chatId}`, 0);
    const response = await fetchFn(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
      }),
    });
    if (response.ok) return;
    const body = (await response.json().catch(() => null)) as { description?: string } | null;
    // The token is in the URL: never put the URL in the error.
    throw new TelegramSendError(
      `Telegram sendMessage ${response.status}: ${body?.description ?? 'no description'}`,
      response.status,
    );
  };
}

/** Local stand-in: the console, plus the dev mailbox (`/api/dev/mailbox?to=tg-<id>`) for tests. */
export const DEV_TELEGRAM_PREFIX = 'tg-';

export function consoleTelegramSender(mailbox?: KVNamespace | null): TelegramSender {
  return async (chatId, text) => {
    console.info(`[clavis telegram] to ${chatId}:\n${text}\n[end telegram]`);
    if (!mailbox) return;
    const entry: DevMailboxEntry = {
      kind: 'reminder',
      subject: text.split('\n')[0] ?? '',
      text,
      code: null,
      at: Date.now(),
    };
    await mailbox.put(DEV_MAILBOX_PREFIX + DEV_TELEGRAM_PREFIX + chatId, JSON.stringify(entry), {
      expirationTtl: 600,
    });
  };
}
