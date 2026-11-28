/**
 * Work the Worker's cron does. 04:00 UTC is 09:00 in Ashgabat (no daylight
 * saving), when deadline reminders go out, by email or by the Telegram bot.
 */
import { getMailer, getTelegramSender, siteUrl } from './auth/server.ts';
import { createDb } from './db/client.ts';
import { runReminders } from './reminders.ts';
import { today } from './server.ts';

export const REMINDER_CRON = '0 4 * * *';

export async function runScheduled(cron: string, env: Env): Promise<void> {
  if (cron === REMINDER_CRON) {
    const run = await runReminders({
      db: createDb(env.DB),
      mailer: getMailer(),
      telegram: getTelegramSender(),
      siteUrl: siteUrl(),
      today: today(),
    });
    console.info(
      `[clavis reminders] sent ${run.sent}, failed ${run.failed}, skipped ${run.skipped}`,
    );
  }
}
