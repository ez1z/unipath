import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createUniversityAction,
  updateUniversityAction,
  deleteUniversityAction,
  toggleMoeApprovedAction,
} from '@/app/admin/universities/actions';

const ADMIN_USER = { id: 'admin-123' };
const ADMIN_ROW = { user_id: 'admin-123' };

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const validFormFields = {
  name_en: 'Test University',
  name_ru: 'Тест Университет',
  name_tk: 'Test Uni',
  country: 'Turkey',
  city: 'Istanbul',
  tuition_usd: '5000',
  languages: 'English|Turkish',
  majors: 'Computer Science|Engineering',
  official_website: 'https://test.edu',
  application_portal_url: 'https://apply.test.edu',
};

function makeAdminSupabase({ insertError = null, updateError = null, deleteError = null } = {}) {
  const adminChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
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

  const fromMock = vi.fn()
    .mockReturnValueOnce(adminChain)
    .mockReturnValueOnce(insertChain)
    .mockReturnValue(updateChain);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
    from: fromMock,
    _adminChain: adminChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
    _deleteChain: deleteChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUniversityAction — validation', () => {
  it('returns error when name_en is empty', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createUniversityAction(makeFormData({ ...validFormFields, name_en: '' }));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/name_en/i);
  });

  it('returns error when official_website is not a URL', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createUniversityAction(
      makeFormData({ ...validFormFields, official_website: 'not-a-url' })
    );
    expect(result).toHaveProperty('error');
  });

  it('returns error when languages is empty', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createUniversityAction(
      makeFormData({ ...validFormFields, languages: '' })
    );
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/language/i);
  });

  it('returns error when tuition_usd is negative', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createUniversityAction(
      makeFormData({ ...validFormFields, tuition_usd: '-500' })
    );
    expect(result).toHaveProperty('error');
  });
});

describe('createUniversityAction — DB errors', () => {
  it('returns friendly error on duplicate name_en (error code 23505)', async () => {
    const supabase = makeAdminSupabase({ insertError: { code: '23505', message: 'unique violation' } });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createUniversityAction(makeFormData(validFormFields));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/already exists/i);
  });
});

describe('createUniversityAction — success', () => {
  it('redirects to /admin/universities on success', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await createUniversityAction(makeFormData(validFormFields));
    expect(redirect).toHaveBeenCalledWith('/admin/universities');
  });

  it('calls revalidatePath for all locales on success', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await createUniversityAction(makeFormData(validFormFields));
    expect(revalidatePath).toHaveBeenCalledWith('/tk/universities');
    expect(revalidatePath).toHaveBeenCalledWith('/ru/universities');
    expect(revalidatePath).toHaveBeenCalledWith('/en/universities');
  });
});

describe('updateUniversityAction — validation', () => {
  it('returns error when name_en is empty', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await updateUniversityAction(
      'uni-id',
      makeFormData({ ...validFormFields, name_en: '' })
    );
    expect(result).toHaveProperty('error');
  });

  it('returns friendly error on duplicate name (23505)', async () => {
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'unique violation' } }),
    };
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(updateChain),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await updateUniversityAction('uni-id', makeFormData(validFormFields));
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/already exists/i);
  });
});

describe('deleteUniversityAction', () => {
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

    const result = await deleteUniversityAction('uni-id');
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

    const result = await deleteUniversityAction('uni-id');
    expect(result).toHaveProperty('error');
    expect(result.success).toBe(false);
  });
});

describe('toggleMoeApprovedAction', () => {
  it('flips moe_approved from false to true', async () => {
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(updateChain),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleMoeApprovedAction('uni-id', false);
    expect(result).toEqual({ success: true });
    expect(updateChain.update).toHaveBeenCalledWith({ moe_approved: true });
  });

  it('flips moe_approved from true to false', async () => {
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
    };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }) },
      from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(updateChain),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleMoeApprovedAction('uni-id', true);
    expect(result).toEqual({ success: true });
    expect(updateChain.update).toHaveBeenCalledWith({ moe_approved: false });
  });
});
