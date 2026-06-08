import { z } from 'zod';

export const ProfileSchema = z.object({
  display_name: z.string().max(80).optional().nullable(),

  toefl_total: z.coerce.number().int().min(0).max(120).optional().nullable(),
  ielts_overall: z.coerce
    .number()
    .min(0)
    .max(9)
    .refine((v) => v == null || v * 2 === Math.round(v * 2), 'Must be a 0.5 increment')
    .optional()
    .nullable(),
  sat_total: z.coerce.number().int().min(400).max(1600).optional().nullable(),
  act_total: z.coerce.number().int().min(1).max(36).optional().nullable(),
  gre_total: z.coerce.number().int().min(260).max(340).optional().nullable(),
  gmat_total: z.coerce.number().int().min(200).max(800).optional().nullable(),
  duolingo_score: z.coerce.number().int().min(10).max(160).optional().nullable(),

  gpa: z.coerce.number().min(0).max(100).optional().nullable(),
  gpa_scale: z.enum(['4.0', '5.0', '100-point']).default('4.0'),

  desired_countries: z.array(z.string()).default([]),
  desired_majors: z.array(z.string()).default([]),
  dream_university_ids: z.array(z.string().uuid()).default([]),
  interested_scholarship_ids: z.array(z.string().uuid()).default([]),

  budget_usd: z.coerce.number().min(0).optional().nullable(),
});

export type ProfileFormData = z.infer<typeof ProfileSchema>;
