-- Document progress as a diff against the university's requirements, rather
-- than a copy of them.
--
-- The old `document_checklist_items` table stored one row per checklist line,
-- seeded from a template the first time a student opened a university page.
-- That made the checklist invisible everywhere else (the list page showed
-- "Not started" for every university), impossible for signed-out students
-- (rows need server-minted ids), and frozen at seed time (later corrections to
-- a university's requirements never reached anyone).
--
-- Storing only what the student changed fixes all three: the checklist is
-- derived on demand, so it exists immediately and stays current, and a browser
-- can hold the same diff in localStorage for guests.
create table if not exists public.document_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  checked       text[] not null default '{}',
  removed       text[] not null default '{}',
  custom        jsonb  not null default '[]',
  updated_at    timestamptz not null default now(),
  primary key (user_id, university_id),
  constraint document_progress_checked_len check (cardinality(checked) <= 84),
  constraint document_progress_removed_len check (cardinality(removed) <= 64),
  constraint document_progress_custom_len  check (jsonb_array_length(custom) <= 20)
);

comment on column public.document_progress.checked is
  'ids of ticked items, template and custom alike, so tickedness has a single home';
comment on column public.document_progress.removed is
  'template ids the student deleted; custom items are dropped from `custom` instead';
comment on column public.document_progress.custom is
  '[{"id":"c:<uuid>","name":"..."}] — items the student added, in display order';

alter table public.document_progress enable row level security;

drop policy if exists "users_manage_own_document_progress" on public.document_progress;
create policy "users_manage_own_document_progress"
  on public.document_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists document_progress_set_updated_at on public.document_progress;
create trigger document_progress_set_updated_at
  before update on public.document_progress
  for each row execute procedure public.set_updated_at();
