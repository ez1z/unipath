create table if not exists public.document_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  is_checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_checklist_items enable row level security;

create policy "users_manage_own_checklist"
  on public.document_checklist_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists document_checklist_items_user_uni
  on public.document_checklist_items(user_id, university_id);
