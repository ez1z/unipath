-- Standard case: B2 English-or-Italian programmes -> IELTS 5.5 / TOEFL 72 (B2 floor, matches published Italian university policies e.g. Pisa, Trento, Milan, Sapienza)
UPDATE universities
SET entrance_requirements = jsonb_set(
  entrance_requirements,
  '{italy}',
  (entrance_requirements -> 'italy') - 'ielts' || jsonb_build_object(
    'ielts_min', 5.5,
    'toefl_min', 72,
    'notes', 'CEFR B2 required (English or Italian depending on programme)'
  )
)
WHERE country = 'Italy'
  AND name_en NOT IN (
    'Università Vita-Salute San Raffaele',
    'Politecnico di Bari',
    'Sapienza University of Rome'
  );

-- San Raffaele: International MD programme requires C1, not B2
UPDATE universities
SET entrance_requirements = jsonb_set(
  entrance_requirements,
  '{italy}',
  (entrance_requirements -> 'italy') - 'ielts' || jsonb_build_object(
    'ielts_min', 7.0,
    'toefl_min', 95,
    'notes', 'CEFR C1 required for the International MD Program (higher than the typical B2 used elsewhere in Italy)'
  )
)
WHERE country = 'Italy' AND name_en = 'Università Vita-Salute San Raffaele';

-- Politecnico di Bari: instruction is primarily Italian; B2 English only applies to the rare English-taught Master's
UPDATE universities
SET entrance_requirements = jsonb_set(
  entrance_requirements,
  '{italy}',
  (entrance_requirements -> 'italy') - 'ielts' || jsonb_build_object(
    'ielts_min', 5.5,
    'toefl_min', 72,
    'notes', 'Most Bachelor''s programmes are taught in Italian (B2 Italian typically required); IELTS/TOEFL B2-equivalent applies only to the few English-taught Master''s programmes'
  )
)
WHERE country = 'Italy' AND name_en = 'Politecnico di Bari';

-- Sapienza: was completely empty, fill in with the same standard as the rest of Italy
UPDATE universities
SET entrance_requirements = jsonb_build_object(
  'italy', jsonb_build_object(
    'ielts_min', 5.5,
    'toefl_min', 72,
    'notes', 'CEFR B2 required (English or Italian depending on programme); some programmes (e.g. Medicine) require an additional entrance test',
    'application_portal', 'https://www.uniroma1.it/en/admissions'
  ),
  'source', 'uniroma1.it, 2026-27 cycle',
  'general', jsonb_build_object(
    'bachelor_requirement', 'Secondary school diploma valid for university access',
    'master_requirement', 'Relevant Bachelor''s degree',
    'language_requirement', 'B2 English or Italian depending on programme',
    'note', 'Application fee €30 per submission, max 2 applications per academic year'
  )
)
WHERE country = 'Italy' AND name_en = 'Sapienza University of Rome';
