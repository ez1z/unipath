/**
 * Work the Worker's crons do (wrangler.jsonc `triggers.crons`), in UTC;
 * Ashgabat is UTC+5 with no daylight saving.
 *
 * - 04:00 (09:00 Ashgabat): deadline reminders, by the Telegram bot (or email, when set up).
 * - 23:00 (04:00 Ashgabat, the quietest hour): D1 backup to R2, when R2 is set up.
 */
import { emailEnabled, getMailer, getTelegramSender, siteUrl } from './auth/server.ts';
import { BACKUP_CRON, runBackup } from './backup.ts';
import { createDb } from './db/client.ts';
import { runReminders } from './reminders.ts';
import { today } from './server.ts';

export const REMINDER_CRON = '0 4 * * *';

export async function runScheduled(cron: string, env: Env): Promise<void> {
  if (cron === REMINDER_CRON) {
    const run = await runReminders({
      db: createDb(env.DB),
      // No sender: email reminders wait (unsent, unlogged) until email is set up.
      mailer: emailEnabled() ? getMailer() : null,
      telegram: getTelegramSender(),
      siteUrl: siteUrl(),
      today: today(),
    });
    console.info(
      `[clavis reminders] sent ${run.sent}, failed ${run.failed}, skipped ${run.skipped}`,
    );
  }
  if (cron === BACKUP_CRON) {
    // No R2 bucket in production for now (server.ts filesBucket): D1 Time Travel only.
    const files = (env as { FILES?: R2Bucket }).FILES;
    if (!files) {
      console.info('[clavis backup] skipped: file storage (R2) is off');
      return;
    }
    const backup = await runBackup(env.DB, files, today());
    console.info(
      `[clavis backup] wrote ${backup.key} (${backup.bytes} bytes), removed ${backup.deleted.length} old`,
    );
  }
}
