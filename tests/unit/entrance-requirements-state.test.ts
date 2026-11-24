import { describe, it, expect } from 'vitest';
import {
  editCountry,
  editEssay,
  editTest,
  parseState,
  serializeState,
  type TestEntry,
} from '@/lib/admin/entrance-requirements-state';

// Entrance requirements objects from the live site (long strings trimmed).
const SAMPLES: Record<string, unknown>[] = [
  {
    "tests": [
      {
        "type": "ielts",
        "format": "academic",
        "min_score": 6.5,
        "min_section_score": 6
      },
      {
        "type": "toefl",
        "format": "ibt/home edition",
        "min_score": 85,
        "min_section_score": 20
      },
      {
        "type": "cambridge c2 proficiency",
        "min_score": 180
      }
    ],
    "source": "en.aau.dk (Admission Requirements for Non-EU Applicants; English Requirements)",
    "denmark": {
      "note": "EU/EEA/Swiss citizens study tuition-free; non-EU/EEA pay tuition that varies by program. Known for Problem ...",
      "english_taught_bachelor_programs": [
        "Applied Industrial Electronics (Esbjerg)",
        "Energy Engineering (Esbjerg)",
        "Chemical Engineering and Biotechnology (Esbjerg)",
        "Economics and Business Administration (Aalborg)"
      ]
    },
    "document_requirements": [
      "Upper-secondary diploma (original + certified English translation)",
      "English test score uploaded directly to optagelse.dk (test-center verification only — no mailed/emailed sco...",
      "Signed Signature Page emailed to bacheloroptag@aau.dk"
    ]
  },
  {
    "usa": {
      "sat": true,
      "essays": false
    },
    "tests": [
      {
        "type": "toefl",
        "format": "ibt",
        "min_score": 79
      },
      {
        "type": "ielts",
        "min_score": 6.5
      }
    ],
    "united_states": {
      "notes": "Public university, Auburn AL. US-focus sprint day 21 fix. Four-ranking check: QS 851 already inside top 100...",
      "source": "auburn.edu admissions international page and ISSS cost page",
      "sat_act_note": "SAT or ACT is REQUIRED for all international freshmen, scores sent directly by the testing agency, SAT code...",
      "gpa_requirement": "Minimum 3.0 GPA on the evaluated high school transcript.",
      "next_intake_note": "Fall 2027 (official international admissions page): application opens Aug 1, 2026 (CORRECTED from Aug 15); ...",
      "financial_aid_note": "No verified Auburn scholarship or need-based aid for international first-years; no full ride found. The off...",
      "english_proficiency": "TOEFL iBT 79 (CBT 213, PBT 550), PTE 53, IELTS 6.5 (official international page). Duolingo is not accepted....",
      "document_requirements": [
        "Application (Common App or Auburn application) with 60 USD non-refundable fee",
        "SAT or ACT scores sent directly by the testing agency (SAT code 1005, ACT code 0011) - required for all int...",
        "TOEFL iBT 79, IELTS 6.5 or PTE 53 sent directly by the testing agency",
        "Official high school transcript evaluated by an independent credential evaluator (WES preferred; any NACES ...",
        "Affidavit of Financial Support signed within one year of enrollment before a notary, attorney, consular or ...",
        "Supporting bank letter on official bank stationery with a specific USD amount, signed within one year of en...",
        "After admission: I-20 for F-1; mandatory Auburn health insurance (about 2,317 estimated for 2027-28)"
      ]
    }
  },
  {
    "notes": "moe_approved=true via QS 613 (top 1000; THE/ARWU/Moscow not separately checked). CUNY is a multi-campus sys...",
    "tests": [],
    "essays": [],
    "document_requirements": [
      "Complete secondary records with English translation plus national certificates",
      "TOEFL, IELTS or PTE (Duolingo accepted) for F-1/J-1 applicants",
      "SAT/ACT optional",
      "Financial documents for I-20 (amount UNVERIFIED)"
    ]
  },
  {
    "uk": {
      "notes": "Wales, coastal town",
      "ielts_min": 6,
      "personal_statement": true,
      "ielts_component_min": 5.5
    }
  },
  {
    "italy": {
      "notes": "CEFR B2 required (English or Italian depending on programme)",
      "ielts_min": 5.5,
      "toefl_min": 72,
      "application_portal": "https://www.unibo.it/en/study"
    },
    "source": "unibo.it, 2025-26 cycle",
    "general": {
      "master_requirement": "Relevant Bachelor's degree",
      "application_fee_eur": 50,
      "bachelor_requirement": "Secondary school diploma valid for university access",
      "language_requirement": "B2 English or Italian depending on programme; SAT/TOLC for some Bachelor's, GRE for some Master's"
    }
  },
  {
    "source": "isoidb.ankara.edu.tr — official 2026-2027 International Student Admission Announcement (PDF), May 2026",
    "turkey": {
      "yos": true,
      "note": "No foreign-language (English) proficiency requirement for Turkish-medium programs — but Turkish proficiency...",
      "sat_min": {
        "math": 650,
        "note": "SAT results must be from June 2024–June 2026 for the 2026-2027 cycle; only Math score is used in placement ...",
        "total": 1100
      },
      "quota_rule": "No more than 10% of a program's international-quota seats may go to citizens of any single country (nationa...",
      "exam_options": [
        "TR-YÖS",
        "SAT",
        "International Baccalaureate",
        "A-Levels",
        "ABITUR",
        "GCE A-Level",
        "TQDK/DİM"
      ],
      "reserved_quota": "10% of seats in Teaching, Dentistry, Law, Pharmacy, and Medicine are reserved for blue-card holders, Turkis...",
      "no_application_fee": true
    },
    "document_requirements": [
      "Online application via ugadmissions.ankara.edu.tr",
      "Certified High School Diploma + sworn-translator Turkish translation",
      "Official transcript covering all high-school years + sworn Turkish translation",
      "Valid exam result (TR-YÖS/SAT/IB/ABITUR/etc. — only one exam type per application)",
      "Passport copy (photo + ID pages)"
    ]
  }
];

function roundTrip(x: unknown) {
  return JSON.parse(serializeState(parseState(JSON.stringify(x))));
}

// Parse, apply an edit to the editor state, serialize back to an object.
function edit(x: unknown, fn: (s: ReturnType<typeof parseState>) => void) {
  const s = parseState(JSON.stringify(x));
  fn(s);
  return JSON.parse(serializeState(s));
}

describe('entrance requirements state: round trip', () => {
  SAMPLES.forEach((sample, i) => {
    it(`keeps sample ${i + 1} unchanged`, () => {
      expect(roundTrip(sample)).toEqual(sample);
    });
  });

  it('keeps unknown top-level keys and non-array document_requirements', () => {
    const x = { source: 's', denmark: { note: 'n' }, document_requirements: 'passport', usa: 'n/a' };
    expect(roundTrip(x)).toEqual(x);
  });

  it('keeps pretty-printed input (as the university edit page passes it)', () => {
    expect(JSON.parse(serializeState(parseState(JSON.stringify(SAMPLES[5], null, 2))))).toEqual(SAMPLES[5]);
  });

  it('keeps raw toefl format and extra test fields', () => {
    const x = { tests: [{ type: 'toefl', format: 'ibt/home edition', min_score: 85, note: 'x' }] };
    expect(roundTrip(x)).toEqual(x);
  });
});

describe('entrance requirements state: editing', () => {
  const base = SAMPLES[1] as { usa: Record<string, unknown>; tests: Record<string, unknown>[] } & Record<string, unknown>;

  it('changes only the IELTS min_score', () => {
    const out = edit(base, s => {
      const ielts = s.tests.find(t => t.type === 'ielts');
      if (ielts?.type === 'ielts') ielts.min_score = '7';
    });
    expect(out).toEqual({ ...base, tests: [base.tests[0], { type: 'ielts', min_score: 7 }] });
  });

  it('keeps extra fields on an edited test', () => {
    const x = { tests: [{ type: 'ielts', format: 'academic', min_score: 6.5, min_section_score: 6 }] };
    const out = edit(x, s => {
      const t = s.tests[0];
      if (t.type === 'ielts') t.min_score = '7';
    });
    expect(out.tests[0]).toEqual({ type: 'ielts', format: 'academic', min_score: 7, min_section_score: 6 });
  });

  it('changes a raw toefl format only when the admin picks one', () => {
    const x = { tests: [{ type: 'toefl', format: 'ibt/home edition', min_score: 85 }] };
    const out = edit(x, s => {
      const t = s.tests[0];
      if (t.type === 'toefl') t.format = 'ibt';
    });
    expect(out.tests[0]).toEqual({ type: 'toefl', format: 'ibt', min_score: 85 });
  });

  it('unchecking a usa flag keeps the other usa keys', () => {
    const x = { usa: { common_app: true, sat: true, essays: false }, source: 's' };
    const out = edit(x, s => { s.usa.common_app = false; });
    expect(out).toEqual({ usa: { sat: true, essays: false }, source: 's' });
  });

  it('omits a country with nothing left in it', () => {
    const out = edit({ uk: { ucas: true }, source: 's' }, s => { s.uk.ucas = false; });
    expect(out).toEqual({ source: 's' });
  });

  it('removing a test removes only that test', () => {
    const out = edit(base, s => { s.tests = s.tests.filter(t => t.type !== 'toefl'); });
    expect(out).toEqual({ ...base, tests: [base.tests[1]] });
  });

  it('keeps extra essay fields and rewrites managed ones', () => {
    const x = { essays: [{ essay_type: 'why_school', length: 250, length_unit: 'words', prompt_url: 'u' }] };
    const out = edit(x, s => {
      const e = s.essays[0];
      if (e.essay_type !== '__other') e.length = '300';
    });
    expect(out.essays[0]).toEqual({ essay_type: 'why_school', length: 300, length_unit: 'words', prompt_url: 'u' });
  });
});

describe('entrance requirements state: unmanaged raw values of managed fields', () => {
  const x = {
    tests: [{ type: 'toefl', format: 'ibt', min_score: '80' }],
    essays: [{ essay_type: 'supplemental', length: '1 page', length_unit: 'words' }],
    turkey: { yos: 'yes', quota: true },
  };

  // Mirrors the editor: each edit goes through the same helpers the component uses.
  function editToefl(fn: (t: TestEntry) => TestEntry) {
    return edit(x, s => {
      const t = s.tests[0];
      if (t.type !== '__other') s.tests[0] = fn(t);
    });
  }

  it('keeps raw values the inputs cannot show', () => {
    expect(roundTrip(x)).toEqual(x);
    const s = parseState(JSON.stringify(x));
    const t = s.tests[0];
    expect(t.type === 'toefl' && t.min_score).toBe('');
    expect(s.turkey.yos).toBe(false);
  });

  it('a typed value replaces the raw value', () => {
    const out = editToefl(t => editTest(t, { min_score: '85' }));
    expect(out.tests[0]).toEqual({ type: 'toefl', format: 'ibt', min_score: 85 });
  });

  it('clearing a typed value does not bring the raw value back', () => {
    const out = editToefl(t => editTest(editTest(t, { min_score: '85' }), { min_score: '' }));
    expect(out.tests[0]).toEqual({ type: 'toefl', format: 'ibt' });
  });

  it('editing another field keeps the raw value', () => {
    const out = editToefl(t => editTest(t, { format: 'pbt' }));
    expect(out.tests[0]).toEqual({ type: 'toefl', format: 'pbt', min_score: '80' });
  });

  it('checking then unchecking a country flag drops the raw value', () => {
    const out = edit(x, s => { s.turkey = editCountry(editCountry(s.turkey, 'yos', true), 'yos', false); });
    expect(out.turkey).toEqual({ quota: true });
  });

  it('a typed essay length replaces the raw length and unit', () => {
    const out = edit(x, s => {
      const e = s.essays[0];
      if (e.essay_type !== '__other') s.essays[0] = editEssay(e, { length: '500', length_unit: 'characters' });
    });
    expect(out.essays[0]).toEqual({ essay_type: 'supplemental', length: 500, length_unit: 'characters' });
  });

  it('changing only the essay unit keeps the raw length and unit', () => {
    const out = edit(x, s => {
      const e = s.essays[0];
      if (e.essay_type !== '__other') s.essays[0] = editEssay(e, { length_unit: 'characters' });
    });
    expect(out.essays[0]).toEqual(x.essays[0]);
  });

  it('keeps an unknown essay length unit', () => {
    const y = { essays: [{ essay_type: 'supplemental', length: 2, length_unit: 'pages' }] };
    expect(roundTrip(y)).toEqual(y);
  });
});

describe('entrance requirements state: ids', () => {
  it('gives every parsed entry a distinct id', () => {
    const s = parseState(JSON.stringify({
      tests: [{ type: 'ielts' }, 'oops', { type: 'toefl' }],
      essays: [{ essay_type: 'open_prompt' }, { essay_type: 'nope' }],
    }));
    expect(new Set(s.tests.map(t => t.id)).size).toBe(3);
    expect(new Set(s.essays.map(e => e.id)).size).toBe(2);
  });
});

describe('entrance requirements state: passthrough entries', () => {
  const weird = { type: 'pte', min_score: 53 };
  const x = {
    tests: [{ type: 'ielts', min_score: 6 }, weird, 'oops', { type: 'sat', min_math: 600 }],
    essays: [{ essay_type: 'brag_sheet', length: 100 }, { essay_type: 'open_prompt' }, null],
  };

  it('keeps them in their original position', () => {
    const s = parseState(JSON.stringify(x));
    expect(s.tests.map(t => t.type)).toEqual(['ielts', '__other', '__other', 'sat']);
    expect(roundTrip(x)).toEqual(x);
  });

  it('does not rewrite an unknown essay type', () => {
    expect(roundTrip(x).essays[0]).toEqual({ essay_type: 'brag_sheet', length: 100 });
  });

  it('removing a passthrough test removes only it', () => {
    const out = edit(x, s => { s.tests = s.tests.filter(t => !(t.type === '__other' && t.raw === 'oops')); });
    expect(out.tests).toEqual([x.tests[0], weird, x.tests[3]]);
    expect(out.essays).toEqual(x.essays);
  });

  it('removing a passthrough essay removes only it', () => {
    const out = edit(x, s => { s.essays = s.essays.filter(e => e.id !== '0'); });
    expect(out.essays).toEqual([x.essays[1], null]);
    expect(out.tests).toEqual(x.tests);
  });

  it('editing a modeled test keeps passthrough tests in place', () => {
    const out = edit(x, s => {
      const t = s.tests[0];
      if (t.type === 'ielts') t.min_score = '6.5';
    });
    expect(out.tests).toEqual([{ type: 'ielts', min_score: 6.5 }, weird, 'oops', x.tests[3]]);
  });
});

describe('entrance requirements state: empty and invalid input', () => {
  it('serializes empty input to an empty string', () => {
    expect(serializeState(parseState(''))).toBe('');
    expect(serializeState(parseState('{}'))).toBe('');
  });

  it('serializes to an empty string once everything is removed', () => {
    const s = parseState(JSON.stringify({ tests: [{ type: 'ielts', min_score: 6 }] }));
    s.tests = [];
    expect(serializeState(s)).toBe('');
  });

  it('returns invalid JSON unchanged', () => {
    for (const bad of ['{"tests": [', 'not json', '[1,2]', 'null']) {
      const s = parseState(bad);
      expect(s.invalidJson).toBe(bad);
      expect(serializeState(s)).toBe(bad);
    }
  });
});
