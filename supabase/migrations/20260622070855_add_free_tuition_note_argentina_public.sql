UPDATE universities
SET entrance_requirements = jsonb_set(
  entrance_requirements,
  '{argentina}',
  jsonb_build_object(
    'ielts_min', 5.5,
    'toefl_min', 72,
    'notes', 'Public national university — undergraduate tuition is free by law for all students, including international/foreign students (only minor admin/document fees apply). Spanish proficiency (CELU exam) typically required since most programs are taught in Spanish.'
  )
)
WHERE country = 'Argentina'
  AND name_en IN ('Universidad de Buenos Aires', 'Universidad Nacional de Córdoba', 'Universidad Nacional de La Plata');
