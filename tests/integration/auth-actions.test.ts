import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { signInAction } from '@/app/admin/signin/actions';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function makeSupabaseMock({
  user = null as { id: string } | null,
  signInError = null as { message: string } | null,
  adminRow = null as { user_id: string } | null,
} = {}) {
  const adminChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: adminRow, error: null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user },
        error: signInError,
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue(adminChain),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signInAction — Zod validation', () => {
  it('returns error for invalid email format', async () => {
    const supabase = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await signInAction(makeFormData({ email: 'not-an-email', password: 'secret' }));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/email/i);
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('returns error when password is empty', async () => {
    const supabase = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await signInAction(makeFormData({ email: 'admin@test.com', password: '' }));
    expect(result).toHaveProperty('error');
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('returns error when both fields are missing', async () => {
    const supabase = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await signInAction(makeFormData({}));
    expect(result).toHaveProperty('error');
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('signInAction — Supabase auth', () => {
  it('returns error when Supabase auth fails', async () => {
    const supabase = makeSupabaseMock({ signInError: { message: 'Invalid credentials' } });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await signInAction(makeFormData({ email: 'admin@test.com', password: 'wrong' }));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/invalid email or password/i);
  });

  it('returns error when user is not in admins table', async () => {
    const supabase = makeSupabaseMock({
      user: { id: 'user-123' },
      adminRow: null,
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await signInAction(makeFormData({ email: 'user@test.com', password: 'pass' }));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/admin access/i);
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('redirects to /admin when valid admin signs in', async () => {
    const supabase = makeSupabaseMock({
      user: { id: 'admin-123' },
      adminRow: { user_id: 'admin-123' },
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await signInAction(makeFormData({ email: 'admin@test.com', password: 'correct' }));
    expect(redirect).toHaveBeenCalledWith('/admin');
  });
});
