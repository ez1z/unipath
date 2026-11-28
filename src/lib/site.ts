/**
 * Public site settings read from the Worker's vars (wrangler.jsonc). Safe on
 * prerendered pages too: they render in workerd with the same vars.
 */
import { env } from 'cloudflare:workers';

const vars = env as unknown as Record<string, string | undefined>;

/** The Clavis Telegram bot's link, e.g. https://t.me/myclavisbot, or null when none is set. */
export function telegramBotLink(): string | null {
  const name = vars['TELEGRAM_BOT_USERNAME']?.replace(/^@/, '');
  return name ? `https://t.me/${name}` : null;
}
