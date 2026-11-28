/** Admins are users whose `role` is `admin` (set with scripts/make-admin.ts). */
export function isAdmin(signedIn: { user: unknown } | null | undefined): boolean {
  return (signedIn?.user as { role?: unknown } | undefined)?.role === 'admin';
}
