import { z } from 'zod';
import { parseSemestersJson } from '@/lib/types/semester';

export const FormSchema = z.object({
  name_en: z.string().min(1, 'English name is required'),
  name_ru: z.string().min(1, 'Russian name is required'),
  name_tk: z.string().min(1, 'Turkmen name is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  tuition_usd: z.coerce.number().nonnegative('Must be ≥ 0'),
  moe_approved: z.string().optional().transform((v) => v === 'true'),
  ranking_qs: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return null;
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? null : n;
  }),
  languages: z.string().min(1, 'At least one language is required').transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  majors: z.string().min(1, 'At least one major is required').transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  official_website: z.string().url('Must be a valid URL (https://...)'),
  application_portal_url: z.string().url('Must be a valid URL (https://...)'),
  entrance_requirements: z.string().optional().transform((v, ctx) => {
    if (!v || v.trim() === '') return {};
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Entrance requirements must be valid JSON' });
      return z.NEVER;
    }
  }),
  semesters: z.string().optional().transform((v) => {
    if (!v?.trim()) return [];
    try { return parseSemestersJson(JSON.parse(v)); } catch { return []; }
  }),
});
