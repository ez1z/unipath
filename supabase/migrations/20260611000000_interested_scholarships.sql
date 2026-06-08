alter table public.profiles
  add column if not exists interested_scholarship_ids uuid[] not null default '{}';
