-- Optional price ranges. tuition_usd / amount_usd stay the baseline (lower bound)
-- used for sorting, filtering, cards and comparison; the *_max columns hold the
-- optional upper bound. When *_max is null or <= the baseline, the value renders
-- as a single figure; when greater, it renders as a range (x – y).
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_usd_max numeric;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS amount_usd_max numeric;
