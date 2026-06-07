import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { importUniversitiesAction } from '@/app/admin/universities/actions';

const ADMIN_USER = { id: 'admin-123' };
const ADMIN_ROW = { user_id: 'admin-123' };

const validRow = {
  name_en: 'Test University',
  name_ru: 'Тест Университет',
  name_tk: 'Test Uni',
  country: 'Turkey',
  city: 'Istanbul',
  tuition_usd: '5000',
  moe_approved: 'true',
  ranking_qs: '150',
  languages: 'English|Turkish',
  majors: 'Computer Science',
  official_website: 'https://test.edu',
  application_portal_url: 'https://apply.test.edu',
  entrance_requirements: '',
};

function makeAdminSupabase({ upsertError = null } = {}) {
  const adminChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: ADMIN_ROW, error: null }),
  };
  const upsertChain = {
    upsert: vi.fn().mockResolvedValue({ error: upsertError }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER }, error: null }),
    },
    from: vi.fn().mockReturnValueOnce(adminChain).mockReturnValue(upsertChain),
    _upsertChain: upsertChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('importUniversitiesAction', () => {
  it('returns success with count for valid rows', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importUniversitiesAction([validRow]);
    expect(result).toEqual({ success: true, count: 1 });
  });

  it('handles empty array (zero imports)', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importUniversitiesAction([]);
    expect(result).toEqual({ success: true, count: 0 });
  });

  it('returns error with row number when a row is invalid', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const invalidRow = { ...validRow, tuition_usd: '-999' };
    const result = await importUniversitiesAction([invalidRow]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Row 1');
    expect(supabase._upsertChain.upsert).not.toHaveBeenCalled();
  });

  it('returns error identifying correct row index when second row is invalid', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const secondRow = { ...validRow, name_en: 'Another Uni', official_website: 'not-a-url' };
    const result = await importUniversitiesAction([validRow, secondRow]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Row 2');
    expect(supabase._upsertChain.upsert).not.toHaveBeenCalled();
  });

  it('calls upsert with onConflict: name_en', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await importUniversitiesAction([validRow]);
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'name_en' })
    );
  });

  it('returns error when upsert fails', async () => {
    const supabase = makeAdminSupabase({ upsertError: { message: 'DB error', code: '500' } });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importUniversitiesAction([validRow]);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns friendly error on duplicate name_en conflict (23505)', async () => {
    const supabase = makeAdminSupabase({
      upsertError: { code: '23505', message: 'unique violation' },
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await importUniversitiesAction([validRow]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it('revalidates university paths on success', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await importUniversitiesAction([validRow]);
    expect(revalidatePath).toHaveBeenCalledWith('/tk/universities');
    expect(revalidatePath).toHaveBeenCalledWith('/ru/universities');
    expect(revalidatePath).toHaveBeenCalledWith('/en/universities');
  });

  it('does not revalidate paths when validation fails', async () => {
    const supabase = makeAdminSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await importUniversitiesAction([{ ...validRow, tuition_usd: 'bad' }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
