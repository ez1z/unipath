import type { AdminType, RecordType } from '../record-type.ts';
import { collegesAdmin } from './colleges.ts';
import { pathwaysAdmin } from './pathways.ts';
import { programsAdmin } from './programs.ts';
import { scholarshipsAdmin } from './scholarships.ts';
import { universitiesAdmin } from './universities.ts';

export const RECORD_TYPES: Record<AdminType, RecordType> = {
  universities: universitiesAdmin,
  colleges: collegesAdmin,
  programs: programsAdmin,
  pathways: pathwaysAdmin,
  scholarships: scholarshipsAdmin,
};
