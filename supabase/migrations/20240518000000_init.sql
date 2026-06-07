-- Universities table
create table if not exists public.universities (
  id                      uuid primary key default gen_random_uuid(),
  name_en                 text not null,
  name_ru                 text not null,
  name_tk                 text not null,
  country                 text not null,
  city                    text not null,
  tuition_usd             numeric not null default 0,
  moe_approved            boolean not null default false,
  ranking_qs              integer,
  languages               text[] not null default '{}',
  majors                  text[] not null default '{}',
  official_website        text not null default '',
  application_portal_url  text not null default '',
  entrance_requirements   jsonb not null default '{}',
  created_at              timestamptz not null default now(),
  constraint universities_name_en_key unique (name_en)
);

-- Admins table (references Supabase Auth users)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- RLS
alter table public.universities enable row level security;
alter table public.admins enable row level security;

-- Public read on universities (students browsing the site)
create policy "public_read_universities"
  on public.universities for select
  to anon, authenticated
  using (true);

-- Admins can write universities
create policy "admin_write_universities"
  on public.universities for all
  to authenticated
  using  (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- Admins can read their own row (needed for requireAdmin() check)
create policy "admin_read_own_row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());
