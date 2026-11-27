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

/** The visitor's IP as Cloudflare reports it, for rate limits. */
export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}
