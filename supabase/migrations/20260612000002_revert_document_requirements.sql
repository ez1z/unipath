alter table public.universities
  drop column if exists document_requirements;

alter table public.scholarships
  drop column if exists document_requirements;
