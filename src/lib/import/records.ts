/**
 * The "clavis-records/1" import format (docs/data-format.md): a JSON file of
 * universities, pathway colleges, programs, pathways and scholarships that a
 * person or an AI assistant can write from official pages. Records point at
 * each other by slug. Everything is imported as an unpublished draft.
 *
 * docs/records.schema.json is generated from this schema (a unit test keeps
 * them the same): `node scripts/import-records.ts --schema`.
 */
import { z } from 'zod';
import {
  COVERAGES,
  COVERS,
  DOCUMENTS,
  FIELDS,
  MINISTRY_STATUSES,
  PROGRAM_LEVELS,
  TRI_STATES,
  UNIVERSITY_TYPES,
} from '../db/values.ts';

export const RECORDS_FORMAT = 'clavis-records/1';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120)
  .describe(
    'Lowercase letters, digits and dashes, e.g. "demo-university-1". Unique per record type.',
  );
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('A date as YYYY-MM-DD.');
const url = z
  .string()
  .max(2000)
  .regex(/^https?:\/\/\S+$/)
  .describe('A full http(s) address.');
const country = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .describe('ISO 3166-1 alpha-2 code of a country already in Clavis, e.g. "TR".');

/** English is required; Turkmen and Russian are optional (the site shows "Not translated yet"). */
const names = z
  .object({ en: text(300), tk: text(300).optional(), ru: text(300).optional() })
  .strict()
  .describe('The name in English (required), Turkmen and Russian.');
const longText = z
  .object({ en: text(4000), tk: text(4000).optional(), ru: text(4000).optional() })
  .strict();
const textList = z
  .object({
    en: z.array(text(500)).max(30),
    tk: z.array(text(500)).max(30).optional(),
    ru: z.array(text(500)).max(30).optional(),
  })
  .strict();

const recordFacts = {
  source_url: url
    .nullable()
    .optional()
    .describe('The official page the facts were checked on. Needed before an admin can publish.'),
  last_checked: date
    .optional()
    .describe('When the facts were checked. Defaults to the import day.'),
};

export const universityRecord = z
  .object({
    slug,
    name: names,
    country,
    city: text(120),
    type: z.enum(UNIVERSITY_TYPES).nullable().optional(),
    website: url.nullable().optional(),
    ministry_status: z
      .enum(MINISTRY_STATUSES)
      .default('unchecked')
      .describe('"approved" only with ministry_basis. Defaults to "unchecked".'),
    ministry_basis: text(300)
      .nullable()
      .optional()
      .describe('Which Ministry list, order or letter, e.g. "QS 2026 position 312".'),
    rankings: z
      .object({
        qs: z.int().min(1).max(100000).nullable().optional(),
        the: z.int().min(1).max(100000).nullable().optional(),
        arwu: z.int().min(1).max(100000).nullable().optional(),
        moscow: z.int().min(1).max(100000).nullable().optional(),
      })
      .strict()
      .optional(),
    ...recordFacts,
  })
  .strict();

export const collegeRecord = z
  .object({
    slug,
    name: names,
    country,
    city: text(120),
    website: url.nullable().optional(),
    ...recordFacts,
  })
  .strict();

export const programRecord = z
  .object({
    slug,
    name: names,
    university: slug.optional().describe('Slug of the university that teaches it.'),
    college: slug.optional().describe('Slug of the pathway college, instead of a university.'),
    level: z.enum(PROGRAM_LEVELS),
    field: z
      .enum(FIELDS)
      .nullable()
      .optional()
      .describe('Field of study; leave out for language years.'),
    language_of_study: z
      .string()
      .regex(/^[a-z]{2}$/)
      .describe('ISO 639-1 code, e.g. "en".'),
    duration_years: z.number().min(0.5).max(8),
    tuition_per_year_usd: z
      .int()
      .min(0)
      .max(1000000)
      .nullable()
      .optional()
      .describe('Leave out or null when not confirmed. Never an estimate.'),
    intakes: z.array(z.int().min(1).max(12)).max(12).default([]).describe('Start months, 1–12.'),
    application_deadline: date.nullable().optional(),
    pre_year_required: z
      .enum(TRI_STATES)
      .optional()
      .describe("Bachelor's only: does a school-leaver from Turkmenistan need a pre-year first?"),
    requirements: z
      .object({
        ielts_min: z.number().min(0).max(9).nullable().optional(),
        other_tests: z
          .array(z.object({ name: text(60), min: text(60).nullable().optional() }).strict())
          .max(10)
          .optional(),
        documents: z.array(z.enum(DOCUMENTS)).max(DOCUMENTS.length).optional(),
      })
      .strict()
      .optional(),
    ...recordFacts,
  })
  .strict();

export const pathwayRecord = z
  .object({
    from: slug.describe('Slug of a foundation or language program.'),
    to: slug.describe("Slug of a bachelor's program."),
    entry_guaranteed: z.boolean().default(false),
  })
  .strict();

export const scholarshipRecord = z
  .object({
    slug,
    name: names,
    provider: text(200),
    country,
    coverage: z.enum(COVERAGES),
    covers: z.array(z.enum(COVERS)).max(COVERS.length).default([]),
    covers_pre_year: z.enum(TRI_STATES).default('unknown'),
    amount_text: longText.optional().describe('As the provider says it, e.g. "€1,200 a month".'),
    deadline: date.nullable().optional(),
    rolling: z.boolean().default(false),
    open_to_turkmen: z.enum(TRI_STATES).default('unknown'),
    eligibility: textList.optional().describe('One condition per item.'),
    how_to_apply: longText.optional(),
    programs: z
      .array(slug)
      .max(500)
      .default([])
      .describe("Slugs of bachelor's programs it can be used at."),
    universities: z
      .array(slug)
      .max(200)
      .default([])
      .describe("Slugs of universities where it works for every bachelor's program."),
    ...recordFacts,
  })
  .strict();

export const recordsFile = z
  .object({
    $schema: z.string().optional(),
    format: z.literal(RECORDS_FORMAT),
    source: text(500).optional().describe('Where these records came from, kept in the audit log.'),
    universities: z.array(universityRecord).max(2000).default([]),
    colleges: z.array(collegeRecord).max(2000).default([]),
    programs: z.array(programRecord).max(10000).default([]),
    pathways: z.array(pathwayRecord).max(10000).default([]),
    scholarships: z.array(scholarshipRecord).max(2000).default([]),
  })
  .strict();

export type RecordsFile = z.infer<typeof recordsFile>;
export type UniversityRecord = z.infer<typeof universityRecord>;
export type CollegeRecord = z.infer<typeof collegeRecord>;
export type ProgramRecord = z.infer<typeof programRecord>;
export type PathwayRecord = z.infer<typeof pathwayRecord>;
export type ScholarshipRecord = z.infer<typeof scholarshipRecord>;

/** docs/records.schema.json */
export function recordsJsonSchema(): Record<string, unknown> {
  return {
    $id: 'https://clavis.example/records.schema.json',
    title: 'Clavis records import file',
    ...z.toJSONSchema(recordsFile, { io: 'input', target: 'draft-2020-12' }),
  };
}
