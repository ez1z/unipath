UPDATE universities u
SET tuition_usd_max = sub.derived_max
FROM (
  SELECT id,
    (SELECT MAX((opt->>'amount_usd')::numeric)
     FROM jsonb_array_elements(tuition_options) opt
     WHERE opt->>'amount_usd' IS NOT NULL) AS derived_max
  FROM universities
  WHERE country ILIKE '%italy%'
) sub
WHERE u.id = sub.id
  AND sub.derived_max IS NOT NULL;
