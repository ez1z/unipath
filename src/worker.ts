/**
 * The Worker: Astro answers every request; the daily cron (wrangler.jsonc
 * `triggers.crons`) sends deadline reminders and makes the nightly backup.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { runScheduled } from './lib/scheduled.ts';

export default {
  fetch: handle,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduled(controller.cron, env));
  },
} satisfies ExportedHandler<Env>;
