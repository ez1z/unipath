/**
 * Demo data for local development and tests. Every record is clearly fake
 * ("Demo University 1", example.com sources). Never load it into production.
 *
 * Dates are relative to `today`, so deadlines stay in the future (or the past,
 * where a record tests "closed") whenever the seed runs.
 *
 * Shape of the data, so tests can rely on it:
 * - 4 countries: TR, RU, HU, GB.
 * - 9 universities (one unpublished), 2 pathway colleges.
 * - Bachelor's of 3, 3.5, 4, 5 and 6 years; foundation and language years, at
 *   universities and at colleges; some programs unpublished or at an unpublished university.
 * - 13 pathways with total years from 4 to 7.
 * - 5 scholarships: open, rolling, closed, unpublished; linked to programs or whole universities.
 */
import { addDays } from '../src/lib/dates.ts';
import type {
  countries,
  pathwayColleges,
  pathways,
  ProgramRequirements,
  programs,
  scholarshipPrograms,
  scholarships,
  scholarshipUniversities,
  settings,
  topics,
  translations,
  universities,
} from '../src/lib/db/schema.ts';
import { TOPIC_SLUGS, type DocumentCode } from '../src/lib/db/values.ts';

type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];
type TranslationRow = Row<typeof translations>;

export interface DemoData {
  countries: Row<typeof countries>[];
  universities: Row<typeof universities>[];
  pathwayColleges: Row<typeof pathwayColleges>[];
  programs: Row<typeof programs>[];
  pathways: Row<typeof pathways>[];
  scholarships: Row<typeof scholarships>[];
  scholarshipPrograms: Row<typeof scholarshipPrograms>[];
  scholarshipUniversities: Row<typeof scholarshipUniversities>[];
  translations: TranslationRow[];
  topics: Row<typeof topics>[];
  settings: Row<typeof settings>[];
}

const source = (path: string) => `https://example.com/demo/${path}`;

const BASIC_DOCUMENTS: DocumentCode[] = [
  'passport',
  'school_certificate',
  'transcript',
  'motivation_letter',
  'photos',
];

function requirements(
  ieltsMin: number | null,
  extra: Partial<ProgramRequirements> = {},
): ProgramRequirements {
  return { ieltsMin, otherTests: [], documents: BASIC_DOCUMENTS, ...extra };
}

/** Names of programs in Turkmen and Russian, keyed by the English name. */
const PROGRAM_NAMES: Record<string, { tk: string; ru: string }> = {
  'Business Administration': { tk: 'Biznes dolandyryşy', ru: 'Деловое администрирование' },
  'Computer Engineering': { tk: 'Kompýuter inženerçiligi', ru: 'Компьютерная инженерия' },
  Medicine: { tk: 'Lukmançylyk', ru: 'Медицина' },
  'Turkish Language Year': { tk: 'Türk dili ýyly', ru: 'Год турецкого языка' },
  'International Relations': { tk: 'Halkara gatnaşyklary', ru: 'Международные отношения' },
  Economics: { tk: 'Ykdysadyýet', ru: 'Экономика' },
  'Foundation Year': { tk: 'Taýýarlyk ýyly', ru: 'Подготовительный год' },
  Architecture: { tk: 'Binagärlik', ru: 'Архитектура' },
  'Preparatory Faculty': { tk: 'Taýýarlyk fakulteti', ru: 'Подготовительный факультет' },
  'Petroleum Engineering': { tk: 'Nebit inženerçiligi', ru: 'Нефтегазовое дело' },
  'Software Engineering': { tk: 'Programma inženerçiligi', ru: 'Программная инженерия' },
  'Russian Language Year': { tk: 'Rus dili ýyly', ru: 'Год русского языка' },
  'General Medicine': { tk: 'Umumy lukmançylyk', ru: 'Лечебное дело' },
  'Computer Science': { tk: 'Informatika', ru: 'Информатика' },
  'Mechanical Engineering': { tk: 'Mehaniki inženerçilik', ru: 'Машиностроение' },
  Law: { tk: 'Hukuk', ru: 'Юриспруденция' },
  'Business Management': { tk: 'Biznes menejmenti', ru: 'Бизнес-менеджмент' },
  'International Foundation Year': {
    tk: 'Halkara taýýarlyk ýyly',
    ru: 'Международный подготовительный год',
  },
  Pharmacy: { tk: 'Derman öndürmek', ru: 'Фармация' },
  'Foundation in Engineering': {
    tk: 'Inženerçilik boýunça taýýarlyk',
    ru: 'Подготовка к инженерным программам',
  },
  'Foundation in Business': {
    tk: 'Biznes boýunça taýýarlyk',
    ru: 'Подготовка к бизнес-программам',
  },
  'English Language Year': { tk: 'Iňlis dili ýyly', ru: 'Год английского языка' },
  'Draft Program': { tk: 'Taslama maksatnama', ru: 'Черновик программы' },
};

/** Program slugs whose Russian name is left out on purpose, to show "Not translated yet". */
const UNTRANSLATED_RU = new Set(['demo-u3-architecture']);

export function buildDemoData(today: string): DemoData {
  const checked = addDays(today, -14);
  const day = (offset: number) => addDays(today, offset);

  const countryRows: Row<typeof countries>[] = [
    { code: 'TR', popularRank: 1 },
    { code: 'RU', popularRank: 2 },
    { code: 'HU', popularRank: 3 },
    { code: 'GB', popularRank: 4 },
  ];
  const countryNames: Record<string, { tk: string; ru: string; en: string }> = {
    TR: { tk: 'Türkiýe', ru: 'Турция', en: 'Türkiye' },
    RU: { tk: 'Russiýa', ru: 'Россия', en: 'Russia' },
    HU: { tk: 'Wengriýa', ru: 'Венгрия', en: 'Hungary' },
    GB: { tk: 'Beýik Britaniýa', ru: 'Великобритания', en: 'United Kingdom' },
  };

  const uni = (
    n: number,
    countryCode: string,
    city: string,
    extra: Partial<Row<typeof universities>>,
  ): Row<typeof universities> => ({
    id: n,
    slug: `demo-university-${n}`,
    name: `Demo University ${n}`,
    countryCode,
    city,
    type: n % 2 === 0 ? 'private' : 'public',
    website: source(`university-${n}`),
    ministryStatus: 'unchecked',
    lastChecked: checked,
    sourceUrl: source(`university-${n}/source`),
    published: true,
    ...extra,
  });

  const universityRows = [
    uni(1, 'TR', 'Istanbul', {
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 450',
      rankingQs: 450,
    }),
    uni(2, 'TR', 'Ankara', {
      ministryStatus: 'approved',
      ministryBasis: 'THE World University Rankings: 600',
      rankingThe: 600,
    }),
    uni(3, 'TR', 'Izmir', { ministryStatus: 'not_listed' }),
    uni(4, 'RU', 'Moscow', {
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 300',
      rankingQs: 300,
      rankingMoscow: 150,
    }),
    // Checked more than 12 months ago, so admin will flag it.
    uni(5, 'RU', 'Kazan', { rankingMoscow: 400, lastChecked: addDays(today, -400) }),
    uni(6, 'HU', 'Budapest', {
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 600',
      rankingQs: 600,
      rankingArwu: 500,
    }),
    uni(7, 'GB', 'Manchester', {
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 50',
      rankingQs: 50,
    }),
    uni(8, 'GB', 'Leeds', {
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 100',
      rankingQs: 100,
    }),
    // Not published: neither it nor its programs may appear anywhere.
    uni(9, 'HU', 'Debrecen', { ministryStatus: 'approved', rankingQs: 700, published: false }),
  ];

  const collegeRows: Row<typeof pathwayColleges>[] = [
    {
      id: 1,
      slug: 'demo-pathway-college-1',
      name: 'Demo Pathway College 1',
      countryCode: 'GB',
      city: 'London',
      website: source('college-1'),
      lastChecked: checked,
      sourceUrl: source('college-1/source'),
      published: true,
    },
    {
      id: 2,
      slug: 'demo-pathway-college-2',
      name: 'Demo Pathway College 2',
      countryCode: 'HU',
      city: 'Budapest',
      website: source('college-2'),
      lastChecked: checked,
      sourceUrl: source('college-2/source'),
      published: true,
    },
  ];

  type P = Row<typeof programs>;
  const atUniversity = (universityId: number) =>
    ({ providerType: 'university', universityId, collegeId: null }) as const;
  const atCollege = (collegeId: number) =>
    ({ providerType: 'college', universityId: null, collegeId }) as const;
  const program = (
    id: number,
    slug: string,
    provider: ReturnType<typeof atUniversity> | ReturnType<typeof atCollege>,
    fields: Omit<P, 'id' | 'slug' | 'providerType' | 'universityId' | 'collegeId' | 'lastChecked'> &
      Partial<Pick<P, 'lastChecked'>>,
  ): P => ({
    id,
    slug,
    ...provider,
    lastChecked: checked,
    sourceUrl: source(`programs/${slug}`),
    published: true,
    ...fields,
  });

  const programRows: P[] = [
    // Demo University 1 (TR, approved, QS 450)
    program(101, 'demo-u1-business-administration', atUniversity(1), {
      level: 'bachelor',
      name: 'Business Administration',
      field: 'business',
      languageOfStudy: 'en',
      durationYears: 4,
      tuitionPerYearUsd: 6000,
      applicationDeadline: day(60),
      intakes: [9],
      requirements: requirements(6),
      preYearRequired: 'no',
    }),
    program(102, 'demo-u1-computer-engineering', atUniversity(1), {
      level: 'bachelor',
      name: 'Computer Engineering',
      field: 'computing',
      languageOfStudy: 'en',
      durationYears: 4,
      tuitionPerYearUsd: 7000,
      applicationDeadline: day(60),
      intakes: [9],
      requirements: requirements(6.5, { otherTests: [{ name: 'SAT', min: '1200' }] }),
      preYearRequired: 'unknown',
    }),
    program(103, 'demo-u1-medicine', atUniversity(1), {
      level: 'bachelor',
      name: 'Medicine',
      field: 'medicine',
      languageOfStudy: 'tr',
      durationYears: 6,
      // Cost not confirmed.
      tuitionPerYearUsd: null,
      applicationDeadline: day(30),
      intakes: [9],
      requirements: requirements(null, {
        otherTests: [{ name: 'TÖMER', min: 'C1' }],
        documents: [...BASIC_DOCUMENTS, 'medical_certificate'],
      }),
      preYearRequired: 'yes',
    }),
    program(104, 'demo-u1-turkish-language-year', atUniversity(1), {
      level: 'language',
      name: 'Turkish Language Year',
      field: null,
      languageOfStudy: 'tr',
      durationYears: 1,
      tuitionPerYearUsd: 2000,
      applicationDeadline: null,
      intakes: [9, 2],
      requirements: requirements(null, { documents: ['passport', 'school_certificate', 'photos'] }),
      preYearRequired: null,
    }),
    program(105, 'demo-u1-draft-program', atUniversity(1), {
      level: 'bachelor',
      name: 'Draft Program',
      field: 'business',
      languageOfStudy: 'en',
      durationYears: 4,
      tuitionPerYearUsd: 5000,
      applicationDeadline: day(60),
      intakes: [9],
      requirements: requirements(6),
      preYearRequired: 'no',
      published: false,
    }),
    // Demo University 2 (TR, approved, THE 600 only)
    program(201, 'demo-u2-international-relations', atUniversity(2), {
      level: 'bachelor',
      name: 'International Relations',
      field: 'social_sciences',
      languageOfStudy: 'en',
      durationYears: 4,
      tuitionPerYearUsd: 3500,
      // Deadline already passed.
      applicationDeadline: day(-10),
      intakes: [9],
      requirements: requirements(5.5),
      preYearRequired: 'no',
    }),
    program(202, 'demo-u2-economics', atUniversity(2), {
      level: 'bachelor',
      name: 'Economics',
      field: 'business',
      languageOfStudy: 'tr',
      durationYears: 4,
      tuitionPerYearUsd: 3000,
      applicationDeadline: day(90),
      intakes: [9],
      requirements: requirements(null),
      preYearRequired: 'yes',
    }),
    program(203, 'demo-u2-foundation-year', atUniversity(2), {
      level: 'foundation',
      name: 'Foundation Year',
      field: 'social_sciences',
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 2500,
      applicationDeadline: day(40),
      intakes: [9],
      requirements: requirements(4.5),
      preYearRequired: null,
    }),
    // Demo University 3 (TR, not on the Ministry list)
    program(301, 'demo-u3-architecture', atUniversity(3), {
      level: 'bachelor',
      name: 'Architecture',
      field: 'architecture',
      languageOfStudy: 'en',
      durationYears: 4,
      tuitionPerYearUsd: 5000,
      applicationDeadline: day(25),
      intakes: [9],
      requirements: requirements(6, { documents: [...BASIC_DOCUMENTS, 'portfolio'] }),
      preYearRequired: 'no',
    }),
    // Demo University 4 (RU, approved, QS 300)
    program(401, 'demo-u4-preparatory-faculty', atUniversity(4), {
      level: 'foundation',
      name: 'Preparatory Faculty',
      field: 'engineering',
      languageOfStudy: 'ru',
      durationYears: 1,
      tuitionPerYearUsd: 3000,
      applicationDeadline: day(50),
      intakes: [9, 11],
      requirements: requirements(null, {
        documents: ['passport', 'school_certificate', 'medical_certificate', 'photos'],
      }),
      preYearRequired: null,
    }),
    program(402, 'demo-u4-petroleum-engineering', atUniversity(4), {
      level: 'bachelor',
      name: 'Petroleum Engineering',
      field: 'engineering',
      languageOfStudy: 'ru',
      durationYears: 4,
      tuitionPerYearUsd: 4000,
      applicationDeadline: day(70),
      intakes: [9],
      requirements: requirements(null),
      preYearRequired: 'yes',
    }),
    program(403, 'demo-u4-software-engineering', atUniversity(4), {
      level: 'bachelor',
      name: 'Software Engineering',
      field: 'computing',
      languageOfStudy: 'ru',
      durationYears: 4,
      tuitionPerYearUsd: 4200,
      applicationDeadline: day(70),
      intakes: [9],
      requirements: requirements(null),
      preYearRequired: 'yes',
    }),
    // Demo University 5 (RU, unchecked, Moscow ranking only)
    program(501, 'demo-u5-russian-language-year', atUniversity(5), {
      level: 'language',
      name: 'Russian Language Year',
      field: null,
      languageOfStudy: 'ru',
      durationYears: 1,
      tuitionPerYearUsd: 2500,
      applicationDeadline: null,
      intakes: [9],
      requirements: requirements(null, { documents: ['passport', 'school_certificate', 'photos'] }),
      preYearRequired: null,
    }),
    program(502, 'demo-u5-general-medicine', atUniversity(5), {
      level: 'bachelor',
      name: 'General Medicine',
      field: 'medicine',
      languageOfStudy: 'ru',
      durationYears: 6,
      tuitionPerYearUsd: 5000,
      applicationDeadline: day(80),
      intakes: [9],
      requirements: requirements(null, { documents: [...BASIC_DOCUMENTS, 'medical_certificate'] }),
      preYearRequired: 'yes',
    }),
    // Demo University 6 (HU, approved, QS 600)
    program(601, 'demo-u6-computer-science', atUniversity(6), {
      level: 'bachelor',
      name: 'Computer Science',
      field: 'computing',
      languageOfStudy: 'en',
      durationYears: 3.5,
      tuitionPerYearUsd: 5500,
      applicationDeadline: day(35),
      intakes: [9, 2],
      requirements: requirements(5.5),
      preYearRequired: 'no',
    }),
    program(602, 'demo-u6-foundation-year', atUniversity(6), {
      level: 'foundation',
      name: 'Foundation Year',
      field: 'sciences',
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 4000,
      applicationDeadline: day(35),
      intakes: [9],
      requirements: requirements(5),
      preYearRequired: null,
    }),
    // Demo University 7 (GB, approved, QS 50)
    program(701, 'demo-u7-mechanical-engineering', atUniversity(7), {
      level: 'bachelor',
      name: 'Mechanical Engineering',
      field: 'engineering',
      languageOfStudy: 'en',
      durationYears: 3,
      tuitionPerYearUsd: 30000,
      applicationDeadline: day(100),
      intakes: [9],
      requirements: requirements(6.5, {
        documents: [...BASIC_DOCUMENTS, 'recommendation_letter', 'application_fee'],
      }),
      preYearRequired: 'yes',
    }),
    program(702, 'demo-u7-law', atUniversity(7), {
      level: 'bachelor',
      name: 'Law',
      field: 'law',
      languageOfStudy: 'en',
      durationYears: 3,
      tuitionPerYearUsd: 28000,
      applicationDeadline: day(100),
      intakes: [9],
      requirements: requirements(7, {
        documents: [...BASIC_DOCUMENTS, 'recommendation_letter', 'application_fee'],
      }),
      preYearRequired: 'yes',
    }),
    // Demo University 8 (GB, approved, QS 100)
    program(801, 'demo-u8-business-management', atUniversity(8), {
      level: 'bachelor',
      name: 'Business Management',
      field: 'business',
      languageOfStudy: 'en',
      durationYears: 3,
      tuitionPerYearUsd: 25000,
      applicationDeadline: day(110),
      intakes: [9],
      requirements: requirements(6.5, {
        documents: [...BASIC_DOCUMENTS, 'recommendation_letter', 'cv'],
      }),
      preYearRequired: 'yes',
    }),
    program(802, 'demo-u8-international-foundation-year', atUniversity(8), {
      level: 'foundation',
      name: 'International Foundation Year',
      field: 'business',
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 20000,
      applicationDeadline: day(90),
      intakes: [9, 1],
      requirements: requirements(5),
      preYearRequired: null,
    }),
    // Demo University 9 (unpublished university)
    program(901, 'demo-u9-pharmacy', atUniversity(9), {
      level: 'bachelor',
      name: 'Pharmacy',
      field: 'medicine',
      languageOfStudy: 'en',
      durationYears: 5,
      tuitionPerYearUsd: 8000,
      applicationDeadline: day(60),
      intakes: [9],
      requirements: requirements(6),
      preYearRequired: 'unknown',
    }),
    // Demo Pathway College 1 (GB)
    program(1101, 'demo-c1-foundation-engineering', atCollege(1), {
      level: 'foundation',
      name: 'Foundation in Engineering',
      field: 'engineering',
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 22000,
      applicationDeadline: day(80),
      intakes: [9, 1],
      requirements: requirements(5),
      preYearRequired: null,
    }),
    program(1102, 'demo-c1-foundation-business', atCollege(1), {
      level: 'foundation',
      name: 'Foundation in Business',
      field: 'business',
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 21000,
      applicationDeadline: day(80),
      intakes: [9, 1],
      requirements: requirements(5),
      preYearRequired: null,
    }),
    // Demo Pathway College 2 (HU)
    program(1201, 'demo-c2-english-language-year', atCollege(2), {
      level: 'language',
      name: 'English Language Year',
      field: null,
      languageOfStudy: 'en',
      durationYears: 1,
      tuitionPerYearUsd: 3000,
      applicationDeadline: null,
      intakes: [9, 2],
      requirements: requirements(null, { documents: ['passport', 'school_certificate', 'photos'] }),
      preYearRequired: null,
    }),
  ];

  const pathway = (id: number, from: number, to: number, entryGuaranteed: boolean) => ({
    id,
    fromProgramId: from,
    toProgramId: to,
    entryGuaranteed,
  });
  const pathwayRows = [
    pathway(1, 104, 103, true), // 1 + 6 = 7
    pathway(2, 104, 202, false), // 1 + 4 = 5
    pathway(3, 203, 201, true), // 1 + 4 = 5
    pathway(4, 401, 402, true), // 1 + 4 = 5
    pathway(5, 401, 403, true), // 1 + 4 = 5
    pathway(6, 501, 502, true), // 1 + 6 = 7
    pathway(7, 602, 601, false), // 1 + 3.5 = 4.5
    pathway(8, 1201, 601, false), // 1 + 3.5 = 4.5
    pathway(9, 802, 801, true), // 1 + 3 = 4
    pathway(10, 1101, 701, true), // 1 + 3 = 4
    pathway(11, 1102, 801, true), // 1 + 3 = 4
    pathway(12, 1102, 702, false), // 1 + 3 = 4
    pathway(13, 602, 901, false), // leads to an unpublished university: hidden
  ];

  const scholarshipRows: Row<typeof scholarships>[] = [
    {
      id: 1,
      slug: 'demo-scholarship-1',
      name: 'Demo Scholarship 1',
      provider: 'Demo Foundation 1',
      countryCode: 'TR',
      coverage: 'full',
      covers: ['tuition', 'stipend', 'housing', 'insurance'],
      coversPreYear: 'yes',
      amountText: 'Full tuition and 300 USD a month',
      deadline: day(45),
      rolling: false,
      openToTurkmen: 'yes',
      eligibility: [
        'Finished secondary school, or finishing it this year',
        'Under 21 on 1 September',
        'IELTS 6.0, or a Turkish language certificate',
      ],
      howToApply: 'Apply online on the official page, then upload your school certificate.',
      lastChecked: checked,
      sourceUrl: source('scholarship-1'),
      published: true,
    },
    {
      id: 2,
      slug: 'demo-scholarship-2',
      name: 'Demo Scholarship 2',
      provider: 'Demo Government Programme',
      countryCode: 'HU',
      coverage: 'full',
      covers: ['tuition', 'stipend', 'housing'],
      coversPreYear: 'yes',
      amountText: 'Free tuition, housing and a monthly stipend',
      deadline: day(20),
      rolling: false,
      openToTurkmen: 'yes',
      eligibility: ['Citizen of a partner country', 'Good school grades'],
      howToApply: 'Apply through the national portal, then to the university.',
      lastChecked: checked,
      sourceUrl: source('scholarship-2'),
      published: true,
    },
    {
      id: 3,
      slug: 'demo-scholarship-3',
      name: 'Demo Scholarship 3',
      provider: 'Demo University 7 and Demo University 8',
      countryCode: 'GB',
      coverage: 'partial',
      covers: ['tuition'],
      coversPreYear: 'no',
      amountText: 'Up to 50% of tuition',
      deadline: null,
      rolling: true,
      openToTurkmen: 'unknown',
      eligibility: ['Offer for a bachelor’s program'],
      howToApply: 'You are considered automatically when you apply.',
      lastChecked: checked,
      sourceUrl: source('scholarship-3'),
      published: true,
    },
    {
      id: 4,
      slug: 'demo-scholarship-4',
      name: 'Demo Scholarship 4',
      provider: 'Demo University 4',
      countryCode: 'RU',
      coverage: 'partial',
      covers: ['tuition'],
      coversPreYear: 'unknown',
      amountText: null,
      // Closed: the deadline has passed.
      deadline: day(-5),
      rolling: false,
      openToTurkmen: 'yes',
      eligibility: ['Top marks in mathematics'],
      howToApply: null,
      lastChecked: checked,
      sourceUrl: source('scholarship-4'),
      published: true,
    },
    {
      id: 5,
      slug: 'demo-scholarship-5',
      name: 'Demo Scholarship 5',
      provider: 'Demo Foundation 5',
      countryCode: 'TR',
      coverage: 'full',
      covers: ['tuition'],
      coversPreYear: 'no',
      amountText: null,
      deadline: day(30),
      rolling: false,
      openToTurkmen: 'unknown',
      eligibility: [],
      howToApply: null,
      lastChecked: checked,
      sourceUrl: null,
      // Not published: it must not appear, and must not count as "has scholarships".
      published: false,
    },
  ];

  const scholarshipProgramRows = [
    { scholarshipId: 3, programId: 701 },
    { scholarshipId: 3, programId: 801 },
    { scholarshipId: 4, programId: 403 },
    { scholarshipId: 5, programId: 301 },
  ];
  const scholarshipUniversityRows = [
    { scholarshipId: 1, universityId: 1 },
    { scholarshipId: 1, universityId: 2 },
    { scholarshipId: 2, universityId: 6 },
  ];

  // Translations ------------------------------------------------------------
  const tr: TranslationRow[] = [];
  const add = (
    entityType: TranslationRow['entityType'],
    entityId: string | number,
    field: string,
    texts: Partial<Record<'tk' | 'ru' | 'en', string>>,
  ) => {
    for (const [lang, text] of Object.entries(texts) as ['tk' | 'ru' | 'en', string][]) {
      tr.push({ entityType, entityId: String(entityId), lang, field, text });
    }
  };

  for (const [code, names] of Object.entries(countryNames)) add('country', code, 'name', names);
  for (const u of universityRows) {
    add('university', u.id ?? 0, 'name', {
      tk: `Demo uniwersiteti ${u.id}`,
      // Demo University 3 has no Russian name, to show "Not translated yet".
      ...(u.id === 3 ? {} : { ru: `Демо-университет ${u.id}` }),
    });
  }
  for (const c of collegeRows) {
    add('college', c.id ?? 0, 'name', {
      tk: `Demo taýýarlyk kolleji ${c.id}`,
      ru: `Демо-колледж ${c.id}`,
    });
  }
  for (const p of programRows) {
    const names = PROGRAM_NAMES[p.name];
    if (!names) throw new Error(`No translation for program name "${p.name}"`);
    add('program', p.id ?? 0, 'name', {
      tk: names.tk,
      ...(UNTRANSLATED_RU.has(p.slug) ? {} : { ru: names.ru }),
    });
  }
  for (const s of scholarshipRows) {
    add('scholarship', s.id ?? 0, 'name', {
      tk: `Demo stipendiýasy ${s.id}`,
      ru: `Демо-стипендия ${s.id}`,
    });
  }
  // Long fields for Demo Scholarship 1 only; the others fall back to English.
  add('scholarship', 1, 'amount_text', {
    tk: 'Doly okuw tölegi we aýda 300 USD',
    ru: 'Полная оплата обучения и 300 USD в месяц',
  });
  add('scholarship', 1, 'how_to_apply', {
    tk: 'Resmi sahypada onlaýn ýüz tutuň, soňra mekdep şahadatnamaňyzy ýükläň.',
    ru: 'Подайте заявку онлайн на официальной странице, затем загрузите аттестат.',
  });
  add('scholarship', 1, 'eligibility', {
    tk: JSON.stringify([
      'Orta mekdebi tamamlan ýa-da şu ýyl tamamlaýan',
      '1-nji sentýabrda 21 ýaşdan kiçi',
      'IELTS 6.0 ýa-da türk dili şahadatnamasy',
    ]),
    ru: JSON.stringify([
      'Окончил школу или оканчивает её в этом году',
      'Младше 21 года на 1 сентября',
      'IELTS 6.0 или сертификат по турецкому языку',
    ]),
  });

  const topicNames: Record<(typeof TOPIC_SLUGS)[number], { tk: string; ru: string; en: string }> = {
    'choosing-a-country': { tk: 'Ýurt saýlamak', ru: 'Выбор страны', en: 'Choosing a country' },
    scholarships: { tk: 'Stipendiýalar', ru: 'Стипендии', en: 'Scholarships' },
    'documents-and-visas': {
      tk: 'Resminamalar we wizalar',
      ru: 'Документы и визы',
      en: 'Documents and visas',
    },
    tests: { tk: 'Synaglar (IELTS, SAT)', ru: 'Экзамены (IELTS, SAT)', en: 'Tests (IELTS, SAT)' },
    'life-abroad': { tk: 'Daşary ýurtda durmuş', ru: 'Жизнь за рубежом', en: 'Life abroad' },
    'for-parents': { tk: 'Ene-atalar üçin', ru: 'Для родителей', en: 'For parents' },
  };
  const topicRows = TOPIC_SLUGS.map((slug, index) => ({ slug, sort: index + 1 }));
  for (const slug of TOPIC_SLUGS) add('topic', slug, 'name', topicNames[slug]);

  return {
    countries: countryRows,
    universities: universityRows,
    pathwayColleges: collegeRows,
    programs: programRows,
    pathways: pathwayRows,
    scholarships: scholarshipRows,
    scholarshipPrograms: scholarshipProgramRows,
    scholarshipUniversities: scholarshipUniversityRows,
    translations: tr,
    topics: topicRows,
    settings: [
      // Demo value; admins set the real rate and date in M7.
      { key: 'usd_tmt_rate', value: '3.5' },
      { key: 'usd_tmt_rate_date', value: today },
    ],
  };
}
