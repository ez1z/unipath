import { z } from 'zod';

export const ScholarshipFormSchema = z.object({
  name_en: z.string().min(1, 'English name is required'),
  name_ru: z.string().min(1, 'Russian name is required'),
  name_tk: z.string().min(1, 'Turkmen name is required'),
  country: z.string().min(1, 'Country is required'),
  university_id: z.string().optional().transform((v) => v?.trim() || null),
  type: z.enum(['government', 'merit', 'need-based', 'partial'], {
    message: 'Select a valid scholarship type',
  }),
  coverage: z.string().optional().transform((v) =>
    v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []
  ),
  amount_usd: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return null;
    const n = Number(v);
    return isNaN(n) || n <= 0 ? null : n;
  }),
  deadline_text: z.string().optional().transform((v) => v?.trim() || null),
  description_en: z.string().default(''),
  description_ru: z.string().default(''),
  description_tk: z.string().default(''),
  application_url: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === '' || z.string().url().safeParse(v).success, {
      message: 'Must be a valid URL (https://...)',
    })
    .transform((v) => v),
});
