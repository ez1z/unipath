-- Universities: slug derived from name_en (already unique)
alter table public.universities add column if not exists slug text;
update public.universities
  set slug = lower(
    regexp_replace(
      regexp_replace(name_en, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  )
  where slug is null or slug = '';
alter table public.universities alter column slug set not null;
create unique index if not exists universities_slug_key on public.universities (slug);

-- Scholarships: slug derived from name_en + country for uniqueness
alter table public.scholarships add column if not exists slug text;
update public.scholarships
  set slug = lower(
    regexp_replace(
      regexp_replace(name_en || '-' || country, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  )
  where slug is null or slug = '';
alter table public.scholarships alter column slug set not null;
create unique index if not exists scholarships_slug_key on public.scholarships (slug);
