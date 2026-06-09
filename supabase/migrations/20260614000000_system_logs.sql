create table if not exists public.system_logs (
  id         uuid        primary key default gen_random_uuid(),
  level      text        not null default 'error'
               constraint system_logs_level_check check (level in ('error', 'warn', 'info')),
  context    text        not null,
  message    text        not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

alter table public.system_logs enable row level security;

-- No RLS select policy — only service role can read/write
-- Superuser reads via service client in the admin UI

create index if not exists system_logs_created_at_idx on public.system_logs (created_at desc);
create index if not exists system_logs_level_idx       on public.system_logs (level);
create index if not exists system_logs_context_idx     on public.system_logs (context);
