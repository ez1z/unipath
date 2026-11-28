/**
 * Writes public/_headers from src/lib/security.ts: the security headers for
 * prerendered pages and files (the Worker adds the same to everything else).
 * Run after changing SECURITY_HEADERS: `pnpm security:headers`.
 */
import { writeFileSync } from 'node:fs';
import { headersFile } from '../src/lib/security.ts';

writeFileSync('public/_headers', headersFile());
console.log('Wrote public/_headers');
