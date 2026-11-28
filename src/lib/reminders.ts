/**
 * Deadline reminders, run once a day at 09:00 Ashgabat time (the Worker's
 * `scheduled` handler). For each tracked application still before submission,
 * with a deadline 30, 7 or 1 day away, one reminder goes out by the student's
 * chosen channel. `reminder_log` makes sure each is sent only once.
 *
 * If a run is missed, the next one still sends: a reminder is due while the
 * days left are within two days below its mark (30: 28–30, 7: 5–7, 1: 0–1).
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { isLang, type Lang } from '../i18n/config.ts';
import { getTranslations } from '../i18n/index.ts';
import { isPlaceholderEmail } from './auth/telegram-plugin.ts';
import { daysBetween } from './dates.ts';
import type { Db } from './db/client.ts';
import {
  account,
  pathways,
  profiles,
  programs,
  reminderLog,
  scholarships,
  trackerItems,
  user,
} from './db/schema.ts';
import { REMINDER_DAYS, type ReminderChannel, type ReminderDays } from './db/values.ts';
import type { Mail, Mailer } from './email.ts';
import { formatDate } from './format.ts';
import { OPEN_STAGES, reminderHorizon, viewsByIds, type TrackerItemView } from './tracker.ts';

/** How many days below each mark a missed reminder is still sent. */
export const CATCH_UP_DAYS = 2;

/** The reminder due with this many days left, if any. */
export function dueReminder(daysLeft: number): ReminderDays | null {
  for (const mark of REMINDER_DAYS) {
    if (daysLeft <= mark && daysLeft >= Math.max(0, mark - CATCH_UP_DAYS)) return mark;
  }
  return null;
}

/** Sends a Telegram bot message (M6). Absent: Telegram reminders wait for the next run. */
export type TelegramSender = (telegramId: string, text: string) => Promise<void>;

export interface ReminderDeps {
  db: Db;
  mailer: Mailer;
  /** e.g. https://clavis.example, for links in the message. */
  siteUrl: string;
  /** Today in Ashgabat, `YYYY-MM-DD`. */
  today: string;
  telegram?: TelegramSender | null;
  now?: Date;
}

export interface ReminderRun {
  sent: number;
  failed: number;
  /** Already sent before, or nowhere to send it. */
  skipped: number;
}

const pre = alias(programs, 'reminder_pre');

interface DueRow {
  itemId: number;
  userId: string;
  email: string;
  lang: string;
  channel: ReminderChannel;
  deadline: string;
}

/** Open items whose deadline (the student's own, else the record's) is in the next 30 days. */
async function dueRows(db: Db, today: string): Promise<DueRow[]> {
  const deadline = sql<string>`coalesce(${trackerItems.deadlineOverride}, ${programs.applicationDeadline}, ${pre.applicationDeadline}, case when ${scholarships.rolling} then null else ${scholarships.deadline} end)`;
  return db
    .select({
      itemId: trackerItems.id,
      userId: trackerItems.userId,
      email: user.email,
      lang: profiles.preferredLang,
      channel: profiles.reminderChannel,
      deadline,
    })
    .from(trackerItems)
    .innerJoin(user, eq(user.id, trackerItems.userId))
    .innerJoin(profiles, eq(profiles.userId, trackerItems.userId))
    .leftJoin(programs, eq(programs.id, trackerItems.programId))
    .leftJoin(pathways, eq(pathways.id, trackerItems.pathwayId))
    .leftJoin(pre, eq(pre.id, pathways.fromProgramId))
    .leftJoin(scholarships, eq(scholarships.id, trackerItems.scholarshipId))
    .where(
      and(
        inArray(trackerItems.stage, [...OPEN_STAGES]),
        sql`${profiles.reminderChannel} <> 'none'`,
        sql`${deadline} between ${today} and ${reminderHorizon(today)}`,
      ),
    ) as Promise<DueRow[]>;
}

export function reminderMail(
  lang: Lang,
  to: string,
  item: TrackerItemView,
  daysLeft: number,
  links: { item: string; profile: string },
): Mail {
  const t = getTranslations(lang);
  const name = item.provider ? `${item.name.text} · ${item.provider.text}` : item.name.text;
  const date = item.deadline ? formatDate(lang, item.deadline) : '';
  return {
    kind: 'reminder',
    to,
    subject: t('email.reminder.subject', { n: daysLeft, name: item.name.text }),
    text: [
      t('email.reminder.body', { n: daysLeft, name, date }),
      '',
      t('email.reminder.progress', { done: item.done, total: item.total }),
      t('email.reminder.open', { url: links.item }),
      '',
      t('email.reminder.why'),
      t('email.reminder.stop', { url: links.profile }),
      '',
      'Clavis',
    ].join('\n'),
  };
}

/** The same message for a Telegram bot chat (plain text). */
export function reminderText(mail: Mail): string {
  return `${mail.subject}\n\n${mail.text}`;
}

export async function runReminders(deps: ReminderDeps): Promise<ReminderRun> {
  const { db, mailer, siteUrl, today } = deps;
  const now = deps.now ?? new Date();
  const run: ReminderRun = { sent: 0, failed: 0, skipped: 0 };

  const due = (await dueRows(db, today)).flatMap((row) => {
    const mark = dueReminder(daysBetween(today, row.deadline));
    return mark === null ? [] : [{ ...row, mark }];
  });
  if (due.length === 0) return run;

  // Telegram ids for students who chose Telegram.
  const telegramUsers = [
    ...new Set(due.filter((d) => d.channel === 'telegram').map((d) => d.userId)),
  ];
  const telegramIds = new Map<string, string>();
  if (telegramUsers.length > 0) {
    const rows = await db
      .select({ userId: account.userId, accountId: account.accountId })
      .from(account)
      .where(and(eq(account.providerId, 'telegram'), inArray(account.userId, telegramUsers)));
    for (const row of rows) telegramIds.set(row.userId, row.accountId);
  }

  // Texts in each student's language.
  const byLang = new Map<Lang, number[]>();
  for (const d of due) {
    const lang = isLang(d.lang) ? d.lang : 'tk';
    byLang.set(lang, [...(byLang.get(lang) ?? []), d.itemId]);
  }
  const views = new Map<number, TrackerItemView>();
  for (const [lang, ids] of byLang) {
    for (const view of await viewsByIds(db, lang, ids)) views.set(view.id, view);
  }

  for (const d of due) {
    const lang: Lang = isLang(d.lang) ? d.lang : 'tk';
    const item = views.get(d.itemId);
    const telegramId = telegramIds.get(d.userId);
    const canSend =
      item !== undefined &&
      (d.channel === 'email'
        ? !isPlaceholderEmail(d.email)
        : d.channel === 'telegram' && telegramId !== undefined && Boolean(deps.telegram));
    if (!item || !canSend) {
      run.skipped++;
      continue;
    }

    // Claim the reminder first, so two overlapping runs can't both send it.
    const claimed = await db
      .insert(reminderLog)
      .values({ trackerItemId: d.itemId, daysBefore: d.mark, sentAt: now })
      .onConflictDoNothing()
      .returning({ id: reminderLog.trackerItemId });
    if (claimed.length === 0) {
      run.skipped++;
      continue;
    }

    const mail = reminderMail(lang, d.email, item, daysBetween(today, d.deadline), {
      item: `${siteUrl}/${lang}/my/tracker/${item.id}`,
      profile: `${siteUrl}/${lang}/my/profile`,
    });
    try {
      if (d.channel === 'email') await mailer.send(mail);
      else await deps.telegram?.(telegramId ?? '', reminderText(mail));
      run.sent++;
    } catch (error) {
      // Give it back, so the next run (still inside the window) tries again.
      await db
        .delete(reminderLog)
        .where(and(eq(reminderLog.trackerItemId, d.itemId), eq(reminderLog.daysBefore, d.mark)));
      console.error(`[clavis reminders] item ${d.itemId}: ${String(error)}`);
      run.failed++;
    }
  }
  return run;
}
