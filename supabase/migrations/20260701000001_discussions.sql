-- Reddit-like discussions attached to a university or scholarship.
-- Polymorphic entity ref (entity_type + entity_id), nested replies, votes, reports.

create table if not exists public.discussion_messages (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('university','scholarship')),
  entity_id    uuid not null,
  parent_id    uuid references public.discussion_messages(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_label text not null,            -- snapshot: nickname OR masked email at post time
  body         text not null check (char_length(body) between 1 and 4000),
  score        integer not null default 0,   -- denormalized vote sum, trigger-maintained
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists discussion_messages_entity
  on public.discussion_messages(entity_type, entity_id, created_at desc);
create index if not exists discussion_messages_parent
  on public.discussion_messages(parent_id);

create table if not exists public.discussion_votes (
  message_id uuid not null references public.discussion_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.discussion_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.discussion_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 500),
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- Keep discussion_messages.score in sync with votes.
create or replace function public.sync_message_score()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.discussion_messages set score = score + new.value where id = new.message_id;
  elsif (TG_OP = 'DELETE') then
    update public.discussion_messages set score = score - old.value where id = old.message_id;
  elsif (TG_OP = 'UPDATE') then
    update public.discussion_messages set score = score - old.value + new.value where id = new.message_id;
  end if;
  return null;
end;
$$;

drop trigger if exists discussion_votes_score on public.discussion_votes;
create trigger discussion_votes_score
  after insert or update or delete on public.discussion_votes
  for each row execute function public.sync_message_score();

-- Global recent feed: top-level, non-deleted messages joined to their entity's name/slug.
create or replace view public.discussion_feed as
select m.id, m.entity_type, m.entity_id, m.author_label, m.body, m.score, m.created_at,
       u.slug as uni_slug, u.name_tk as uni_tk, u.name_ru as uni_ru, u.name_en as uni_en,
       s.slug as sch_slug, s.name_tk as sch_tk, s.name_ru as sch_ru, s.name_en as sch_en
from public.discussion_messages m
left join public.universities u on m.entity_type = 'university' and m.entity_id = u.id
left join public.scholarships s on m.entity_type = 'scholarship' and m.entity_id = s.id
where m.is_deleted = false and m.parent_id is null;

-- RLS
alter table public.discussion_messages enable row level security;
alter table public.discussion_votes enable row level security;
alter table public.discussion_reports enable row level security;

create policy "discussion_messages_public_read"
  on public.discussion_messages for select
  to anon, authenticated
  using (true);

create policy "discussion_messages_insert_own"
  on public.discussion_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No user update/delete policy: superuser moderation goes through the service client.

create policy "discussion_votes_own"
  on public.discussion_votes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "discussion_reports_insert_own"
  on public.discussion_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);
