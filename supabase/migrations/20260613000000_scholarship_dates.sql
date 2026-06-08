ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS semesters jsonb NOT NULL DEFAULT '[]';

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS semesters jsonb NOT NULL DEFAULT '[]';
