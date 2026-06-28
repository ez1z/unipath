-- Optional acceptance rate, stored as a percentage (0–100). *_min is the baseline
-- (single value or lower bound); *_max is the optional upper bound. When *_max is
-- null or <= *_min the value renders as a single figure (e.g. "45%"); when greater,
-- it renders as a range ("40 – 55%"). Both are nullable — acceptance rate is fully
-- optional for universities and scholarships.
ALTER TABLE universities ADD COLUMN IF NOT EXISTS acceptance_rate_min numeric;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS acceptance_rate_max numeric;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS acceptance_rate_min numeric;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS acceptance_rate_max numeric;
