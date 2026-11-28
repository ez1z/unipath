/**
 * Request-time helpers for server pages and endpoints (workerd only).
 */
import { env } from 'cloudflare:workers';
import { createDb, type Db } from './db/client.ts';
import { todayIn } from './dates.ts';

export function getDb(): Db {
  return createDb(env.DB);
}

/** Today in Asia/Ashgabat, `YYYY-MM-DD`. */
export function today(): string {
  return todayIn();
}

/**
 * File storage (R2: logos, photos, nightly backups), or null when it is off.
 * Production has no R2 bucket for now (R2 asks for a card; Eziz, 2026-11-29):
 * no uploads, no pictures, no nightly backup (D1 Time Travel still runs).
 * Adding the `r2_buckets` binding back (DEPLOY.md, "Turning file storage on")
 * turns it all on again.
 */
export function filesBucket(): R2Bucket | null {
  return (env as unknown as { FILES?: R2Bucket }).FILES ?? null;
}

/** The visitor's IP as Cloudflare reports it, for rate limits. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}
