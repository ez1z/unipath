/**
 * Admin helpers for end-to-end tests: local scripts only (never a remote
 * database), run against the same local D1/R2 as the preview server.
 */
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { signInByEmail } from './account.ts';

/**
 * Runs a script and returns its output. The preview server holds the same
 * local SQLite file, so a write can meet SQLITE_BUSY: try again a few times.
 * A script that fails for another reason throws with its output.
 */
export function script(...args: string[]): string {
  for (let attempt = 1; ; attempt++) {
    try {
      return execFileSync(process.execPath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
      if (attempt < 5 && /SQLITE_BUSY|database is locked/.test(stderr + stdout)) continue;
      throw new Error(`${args.join(' ')} failed:\n${stdout}\n${stderr}`, { cause: error });
    }
  }
}

/** A 300×150 PNG drawn by the browser; the upload island turns it into a 128 px WebP. */
export async function pngFromBrowser(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 150;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'teal';
      context.fillRect(0, 0, 300, 150);
    }
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  return Buffer.from(base64, 'base64');
}

export async function signInAsAdmin(page: Page, email: string) {
  await signInByEmail(page, email);
  script('scripts/make-admin.ts', email);
}
