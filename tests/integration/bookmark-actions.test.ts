import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toggleUniversityBookmark, toggleScholarshipBookmark } from '@/lib/actions/bookmarks';

const USER = { id: 'user-123' };
const UNIVERSITY_ID = 'uni-abc';
const SCHOLARSHIP_ID = 'sch-xyz';

function makeSupabase({
  user = USER as { id: string } | null,
  currentUniversityIds = [] as string[],
  currentScholarshipIds = [] as string[],
} = {}) {
  const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) };

  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (currentUniversityIds.length > 0) {
        return { data: { dream_university_ids: currentUniversityIds } };
      }
      if (currentScholarshipIds.length > 0) {
        return { data: { interested_scholarship_ids: currentScholarshipIds } };
      }
      return { data: null };
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn()
      .mockReturnValueOnce(profileChain)
      .mockReturnValue(upsertChain),
    _upsertChain: upsertChain,
    _profileChain: profileChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toggleUniversityBookmark', () => {
  it('returns unauthenticated when no user is logged in', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleUniversityBookmark(UNIVERSITY_ID, 'en');
    expect(result).toEqual({ unauthenticated: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('saves a university that is not yet bookmarked', async () => {
    const supabase = makeSupabase({ currentUniversityIds: [] });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleUniversityBookmark(UNIVERSITY_ID, 'en');
    expect(result).toEqual({ saved: true });
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ dream_university_ids: [UNIVERSITY_ID] }),
      expect.any(Object)
    );
  });

  it('removes a university that is already bookmarked', async () => {
    const supabase = makeSupabase({ currentUniversityIds: [UNIVERSITY_ID] });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleUniversityBookmark(UNIVERSITY_ID, 'en');
    expect(result).toEqual({ saved: false });
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ dream_university_ids: [] }),
      expect.any(Object)
    );
  });

  it('preserves other bookmarks when adding a new one', async () => {
    const existingId = 'other-uni';
    const supabase = makeSupabase({ currentUniversityIds: [existingId] });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await toggleUniversityBookmark(UNIVERSITY_ID, 'en');
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ dream_university_ids: [existingId, UNIVERSITY_ID] }),
      expect.any(Object)
    );
  });

  it('revalidates the tracker profile path', async () => {
    const supabase = makeSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await toggleUniversityBookmark(UNIVERSITY_ID, 'tk');
    expect(revalidatePath).toHaveBeenCalledWith('/tk/tracker/profile');
  });

  it('uses the provided locale in the revalidated path', async () => {
    const supabase = makeSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await toggleUniversityBookmark(UNIVERSITY_ID, 'ru');
    expect(revalidatePath).toHaveBeenCalledWith('/ru/tracker/profile');
  });
});

describe('toggleScholarshipBookmark', () => {
  it('returns unauthenticated when no user is logged in', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleScholarshipBookmark(SCHOLARSHIP_ID, 'en');
    expect(result).toEqual({ unauthenticated: true });
  });

  it('saves a scholarship that is not yet bookmarked', async () => {
    const supabase = makeSupabase({ currentScholarshipIds: [] });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleScholarshipBookmark(SCHOLARSHIP_ID, 'en');
    expect(result).toEqual({ saved: true });
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ interested_scholarship_ids: [SCHOLARSHIP_ID] }),
      expect.any(Object)
    );
  });

  it('removes a scholarship that is already bookmarked', async () => {
    const supabase = makeSupabase({ currentScholarshipIds: [SCHOLARSHIP_ID] });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await toggleScholarshipBookmark(SCHOLARSHIP_ID, 'en');
    expect(result).toEqual({ saved: false });
    expect(supabase._upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ interested_scholarship_ids: [] }),
      expect.any(Object)
    );
  });

  it('revalidates the tracker profile path', async () => {
    const supabase = makeSupabase();
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await toggleScholarshipBookmark(SCHOLARSHIP_ID, 'en');
    expect(revalidatePath).toHaveBeenCalledWith('/en/tracker/profile');
  });
});
