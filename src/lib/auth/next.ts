/**
 * Where to go after signing in. Only paths on this site are allowed, so a
 * crafted link can't send someone to another site after sign-in.
 */
const MAX_LENGTH = 500;

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return null;
  // One leading slash, then not a second slash or backslash (`//evil.example`, `/\evil`).
  if (!value.startsWith('/') || value[1] === '/' || value[1] === '\\') return null;
  // No control characters (header splitting, odd parsing).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'http://clavis.local');
    if (url.origin !== 'http://clavis.local') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
