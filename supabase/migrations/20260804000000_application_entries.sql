-- "My List" application tracker: one row per (user, university) with the
-- per-application state an array of ids could never hold.
create table if not exists public.application_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  university_id   uuid not null references public.universities(id) on delete cascade,
  tier            text check (tier in ('dream', 'target', 'safety')),
  status          text not null default 'planning'
                    check (status in ('planning', 'applying', 'applied', 'accepted', 'rejected')),
  scholarship_ids uuid[] not null default '{}',
  notes           text check (char_length(notes) <= 2000),
  semester_key    text check (char_length(semester_key) <= 200),
  custom          jsonb not null default '{}',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, university_id)
);

comment on column public.application_entries.tier is
  'null means "use the app''s suggested tier"; a value is an explicit user override';
comment on column public.application_entries.custom is
  'values for user-defined columns, keyed by the column id in profiles.list_columns';
comment on column public.application_entries.semester_key is
  'chosen intake as "name|start_date"; null means "show the nearest deadline". Semesters carry no id of their own, and a name alone is not unique across languages of instruction';

alter table public.application_entries enable row level security;

drop policy if exists "users_manage_own_entries" on public.application_entries;
create policy "users_manage_own_entries"
  on public.application_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists application_entries_user
  on public.application_entries(user_id, sort_order);

drop trigger if exists application_entries_set_updated_at on public.application_entries;
create trigger application_entries_set_updated_at
  before update on public.application_entries
  for each row execute procedure public.set_updated_at();

-- Ordered column layout for the list: fixed and user-defined columns in one
-- array, so order/visibility/definitions are a single mechanism.
-- Empty array falls back to DEFAULT_COLUMNS in the app layer.
alter table public.profiles
  add column if not exists list_columns jsonb not null default '[]';

-- Sort preference for the list: {"sort": {"columnId": "deadline", "dir": "asc"}}
-- or {"sort": null} for the student's manual drag order. Filters are session
-- state and deliberately not stored — a filter that survives a reload is
-- invisible state that reads as missing data.
alter table public.profiles
  add column if not exists list_view jsonb not null default '{}';
