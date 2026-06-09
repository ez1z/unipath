import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({}) }),
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createScholarshipAction,
  updateScholarshipAction,
  deleteScholarshipAction,
  importScholarshipsAction,
} from '@/app/admin/scholarships/actions';

const ADMIN_USER = { id: 'admin-123', email: 'admin@test.com' };
const ADMIN_ROW = { user_id: 'admin-123', role: 'admin' };

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const validFormFields = {
  name_en: 'Global Merit Award',
  name_ru: 'Глобальная награда',
  name_tk: 'Global sylag',
  country: 'Turkey',
  type: 'merit',
  application_url: '',
};

function makeAdminSupabase({
  insertError = null,
  updateError = null,
  deleteError = null,
}: {
  insertError?: { code?: string; message: string } | null;
  updateError?: { code?: string; message: string } | null;
  deleteError?: { code?: string; message: string } | null;
} = {}) {
  const adminChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
  };
  const slugCheckChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  };
  const insertChain = {
    insert: vi.fn().mockResolvedValue({ error: insertError }),
  };
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };
  const deleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: deleteError }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
    from: vi.fn()
      .mockReturnValueOnce(adminChain)
      .mockReturnValueOnce(slugCheckChain)
      .mockReturnValue(insertChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
    _deleteChain: deleteChain,
    _slugCheckChain: slugCheckChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createScholarshipAction — validation', () => {
  it('returns error when name_en is empty', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createScholarshipAction(makeFormData({ ...validFormFields, name_en: '' }));
    expect(result).toHaveProperty('error');
  });

  it('returns error when country is empty', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createScholarshipAction(makeFormData({ ...validFormFields, country: '' }));
    expect(result).toHaveProperty('error');
  });

  it('returns error when type is invalid', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createScholarshipAction(makeFormData({ ...validFormFields, type: 'invalid' }));
    expect(result).toHaveProperty('error');
  });
});

describe('createScholarshipAction — success', () => {
  it('redirects to /admin/scholarships on success', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await createScholarshipAction(makeFormData(validFormFields));
    expect(redirect).toHaveBeenCalledWith('/admin/scholarships');
  });

  it('calls revalidatePath for all locales', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await createScholarshipAction(makeFormData(validFormFields));
    expect(revalidatePath).toHaveBeenCalledWith('/tk/scholarships');
    expect(revalidatePath).toHaveBeenCalledWith('/ru/scholarships');
    expect(revalidatePath).toHaveBeenCalledWith('/en/scholarships');
  });
});

describe('createScholarshipAction — DB errors', () => {
  it('returns error when insert fails', async () => {
    const supabase = makeAdminSupabase({ insertError: { message: 'DB error' } });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createScholarshipAction(makeFormData(validFormFields));
    expect(result).toHaveProperty('error');
  });
});

describe('deleteScholarshipAction', () => {
  it('returns success and revalidates paths', async () => {
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(deleteChain),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await deleteScholarshipAction('sch-id');
    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('returns error when DB delete fails', async () => {
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    };
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(deleteChain),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await deleteScholarshipAction('sch-id');
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });
});

describe('importScholarshipsAction', () => {
  const validImportRow = {
    name_en: 'Global Merit Award',
    name_ru: 'Глобальная награда',
    name_tk: 'Global sylag',
    country: 'Turkey',
    type: 'merit',
  };

  function makeImportSupabase({ upsertError = null }: { upsertError?: { message: string } | null } = {}) {
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const uniLookupChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
    };
    const upsertChain = {
      upsert: vi.fn().mockResolvedValue({ error: upsertError }),
    };
    let adminCalled = false;
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'admins' && !adminCalled) { adminCalled = true; return adminChain; }
        if (table === 'universities') return uniLookupChain;
        return upsertChain;
      }),
      _upsertChain: upsertChain,
    };
  }

  it('returns success with count for valid rows', async () => {
    const supabase = makeImportSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importScholarshipsAction([validImportRow]);
    expect(result).toEqual({ success: true, count: 1 });
  });

  it('handles empty array (zero imports)', async () => {
    const supabase = makeImportSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importScholarshipsAction([]);
    expect(result).toEqual({ success: true, count: 0 });
  });

  it('returns error with row number when a row is invalid', async () => {
    const supabase = makeImportSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const invalidRow = { ...validImportRow, type: 'invalid' };
    const result = await importScholarshipsAction([invalidRow]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Row 1');
  });

  it('returns error when upsert fails', async () => {
    const supabase = makeImportSupabase({ upsertError: { message: 'DB error' } });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importScholarshipsAction([validImportRow]);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('revalidates scholarship paths on success', async () => {
    const supabase = makeImportSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await importScholarshipsAction([validImportRow]);
    expect(revalidatePath).toHaveBeenCalledWith('/tk/scholarships');
    expect(revalidatePath).toHaveBeenCalledWith('/ru/scholarships');
    expect(revalidatePath).toHaveBeenCalledWith('/en/scholarships');
  });
});
