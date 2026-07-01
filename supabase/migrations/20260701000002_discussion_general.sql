-- Allow standalone (general) discussions not tied to a university or scholarship.
alter table public.discussion_messages
  drop constraint if exists discussion_messages_entity_type_check;

alter table public.discussion_messages
  add constraint discussion_messages_entity_type_check
  check (entity_type in ('university','scholarship','general'));

alter table public.discussion_messages
  alter column entity_id drop not null;

-- A general message has no entity; an entity message must have one.
alter table public.discussion_messages
  add constraint discussion_messages_entity_id_presence
  check (
    (entity_type = 'general' and entity_id is null)
    or (entity_type in ('university','scholarship') and entity_id is not null)
  );

-- The cross-entity feed only surfaces university/scholarship threads.
create or replace view public.discussion_feed as
select m.id, m.entity_type, m.entity_id, m.author_label, m.body, m.score, m.created_at,
       u.slug as uni_slug, u.name_tk as uni_tk, u.name_ru as uni_ru, u.name_en as uni_en,
       s.slug as sch_slug, s.name_tk as sch_tk, s.name_ru as sch_ru, s.name_en as sch_en
from public.discussion_messages m
left join public.universities u on m.entity_type = 'university' and m.entity_id = u.id
left join public.scholarships s on m.entity_type = 'scholarship' and m.entity_id = s.id
where m.is_deleted = false
  and m.parent_id is null
  and m.entity_type in ('university','scholarship');

-- Index general top-level threads for the board listing.
create index if not exists discussion_messages_general
  on public.discussion_messages(created_at desc)
  where entity_type = 'general';
