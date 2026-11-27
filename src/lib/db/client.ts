import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

/** Drizzle on D1; `$client` is the raw binding, for tables outside the schema (FTS). */
export type Db = DrizzleD1Database<typeof schema> & { $client: D1Database };

/**
 * Wrap a D1 binding. In the Worker: `createDb(env.DB)` with `env` from 'cloudflare:workers'.
 * Scripts and tests pass a local D1 from wrangler's getPlatformProxy.
 */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}
