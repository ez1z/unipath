-- Add role column to admins table
alter table public.admins
  add column if not exists role text not null default 'admin'
  constraint admins_role_check check (role in ('admin', 'superuser'));

-- Audit logs (service-role access only — no permissive RLS policies)
create table if not exists public.audit_logs (
  id            uuid        primary key default gen_random_uuid(),
  admin_user_id uuid        references auth.users(id) on delete set null,
  admin_email   text        not null,
  action        text        not null,
  entity_type   text,
  entity_id     text,
  entity_name   text,
  details       jsonb,
  created_at    timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_admin_idx     on public.audit_logs (admin_user_id);
