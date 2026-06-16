ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}';
