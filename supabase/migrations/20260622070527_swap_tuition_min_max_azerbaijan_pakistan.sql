UPDATE universities
SET tuition_usd = tuition_usd_max, tuition_usd_max = tuition_usd
WHERE country IN ('Azerbaijan', 'Pakistan')
  AND tuition_usd_max IS NOT NULL AND tuition_usd_max < tuition_usd
  AND name_en IN (
    'Azerbaijan State Oil and Industry University',
    'Azerbaijan State University of Economics',
    'Azerbaijan Technical University',
    'Baku Engineering University',
    'Government College University, Faisalabad',
    'University of Agriculture, Faisalabad'
  );
