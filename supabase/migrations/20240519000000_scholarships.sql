create table if not exists public.scholarships (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid references public.universities(id) on delete set null,
  country         text not null,
  name_en         text not null,
  name_ru         text not null,
  name_tk         text not null,
  type            text not null check (type in ('government','merit','need-based','partial')),
  coverage        text[] not null default '{}',
  amount_usd      numeric,
  deadline_text   text,
  description_en  text not null default '',
  description_ru  text not null default '',
  description_tk  text not null default '',
  application_url text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.scholarships enable row level security;

create policy "public_read_scholarships"
  on public.scholarships for select
  to anon, authenticated
  using (is_active = true);

create policy "admin_write_scholarships"
  on public.scholarships for all
  to authenticated
  using  (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));
