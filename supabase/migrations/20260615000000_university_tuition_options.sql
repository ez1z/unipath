-- Differentiated tuition: a university may charge different amounts depending
-- on the semester, language of instruction, and/or major. The flat tuition_usd
-- column stays as the representative/baseline figure used for sorting, the max
-- tuition filter, cards and comparison; tuition_options carries the breakdown.
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS tuition_options jsonb NOT NULL DEFAULT '[]';
