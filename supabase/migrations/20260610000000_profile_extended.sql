alter table public.profiles
  add column if not exists toefl_total           smallint check (toefl_total between 0 and 120),
  add column if not exists ielts_overall         numeric(3,1) check (ielts_overall between 0.0 and 9.0),
  add column if not exists sat_total             smallint check (sat_total between 400 and 1600),
  add column if not exists act_total             smallint check (act_total between 1 and 36),
  add column if not exists gre_total             smallint check (gre_total between 260 and 340),
  add column if not exists gmat_total            smallint check (gmat_total between 200 and 800),
  add column if not exists duolingo_score        smallint check (duolingo_score between 10 and 160),
  add column if not exists gpa                   numeric(4,2),
  add column if not exists gpa_scale             text not null default '4.0',
  add column if not exists desired_countries     text[]  not null default '{}',
  add column if not exists desired_majors        text[]  not null default '{}',
  add column if not exists dream_university_ids  uuid[]  not null default '{}',
  add column if not exists budget_usd            numeric;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
