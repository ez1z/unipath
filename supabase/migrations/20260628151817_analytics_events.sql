-- First-party product analytics for the admin dashboard.
-- Append-only event log. RLS is enabled with NO policies — only the service role
-- (the /api/track endpoint + the superuser analytics UI) reads and writes, exactly
-- like system_logs / audit_logs.

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  event_type   text not null
                 constraint analytics_events_type_check
                 check (event_type in ('pageview','university_view','scholarship_view','search','ai_question')),
  visitor_id   uuid not null,          -- anonymous up_vid cookie
  user_id      uuid,                   -- set when signed in (no FK — keep inserts cheap)
  path         text,
  locale       text,
  referrer     text,                   -- external referrers only (own host filtered client-side)
  entity_id    uuid,                   -- university / scholarship id for *_view events
  entity_slug  text,
  country      text,                   -- denormalized from the entity (country-interest insight)
  search_query text,
  ai_question  text,
  created_at   timestamptz not null default now()
);

alter table public.analytics_events enable row level security;
-- No RLS policies — service role only.

create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_created_idx      on public.analytics_events (created_at desc);
create index if not exists analytics_events_entity_idx       on public.analytics_events (entity_id) where entity_id is not null;
create index if not exists analytics_events_visitor_idx      on public.analytics_events (visitor_id);

-- ── Aggregation RPCs ────────────────────────────────────────────────────────
-- Called via the service-role client (bypasses RLS). Grouping/aggregation lives
-- in SQL because the Supabase JS client cannot GROUP BY.

create or replace function public.analytics_summary()
returns json
language sql stable
as $$
  select json_build_object(
    'total_users',   (select count(*) from public.profiles),
    'new_users_7d',  (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'dau',           (select count(distinct visitor_id) from public.analytics_events
                        where event_type = 'pageview' and created_at >= date_trunc('day', now())),
    'mau',           (select count(distinct visitor_id) from public.analytics_events
                        where event_type = 'pageview' and created_at >= now() - interval '30 days'),
    'visits_today',  (select count(*) from public.analytics_events
                        where event_type = 'pageview' and created_at >= date_trunc('day', now())),
    'visits_30d',    (select count(*) from public.analytics_events
                        where event_type = 'pageview' and created_at >= now() - interval '30 days'),
    'conversion_rate', (
      select case when v.cnt = 0 then 0
                  else round((s.cnt::numeric / v.cnt) * 100, 1) end
      from (select count(*) cnt from public.profiles
              where created_at >= now() - interval '30 days') s,
           (select count(distinct visitor_id) cnt from public.analytics_events
              where created_at >= now() - interval '30 days') v
    )
  );
$$;

create or replace function public.analytics_visits_daily(p_days int default 30)
returns table(day date, visits bigint, visitors bigint)
language sql stable
as $$
  select d::date,
         count(e.id),
         count(distinct e.visitor_id)
  from generate_series(
         date_trunc('day', now()) - ((p_days - 1) || ' days')::interval,
         date_trunc('day', now()),
         interval '1 day') d
  left join public.analytics_events e
    on e.event_type = 'pageview'
   and e.created_at >= d and e.created_at < d + interval '1 day'
  group by d
  order by d;
$$;

create or replace function public.analytics_visits_monthly(p_months int default 12)
returns table(month date, visits bigint, visitors bigint)
language sql stable
as $$
  select m::date,
         count(e.id),
         count(distinct e.visitor_id)
  from generate_series(
         date_trunc('month', now()) - ((p_months - 1) || ' months')::interval,
         date_trunc('month', now()),
         interval '1 month') m
  left join public.analytics_events e
    on e.event_type = 'pageview'
   and e.created_at >= m and e.created_at < m + interval '1 month'
  group by m
  order by m;
$$;

create or replace function public.analytics_top_universities(p_days int default 30, p_limit int default 10)
returns table(entity_id uuid, entity_slug text, name_en text, country text, moe_approved boolean, views bigint)
language sql stable
as $$
  select u.id, u.slug, u.name_en, u.country, u.moe_approved, count(e.id)
  from public.analytics_events e
  join public.universities u on u.id = e.entity_id
  where e.event_type = 'university_view'
    and e.created_at >= now() - (p_days || ' days')::interval
  group by u.id, u.slug, u.name_en, u.country, u.moe_approved
  order by count(e.id) desc
  limit p_limit;
$$;

create or replace function public.analytics_top_scholarships(p_days int default 30, p_limit int default 10)
returns table(entity_id uuid, entity_slug text, name_en text, views bigint)
language sql stable
as $$
  select s.id, s.slug, s.name_en, count(e.id)
  from public.analytics_events e
  join public.scholarships s on s.id = e.entity_id
  where e.event_type = 'scholarship_view'
    and e.created_at >= now() - (p_days || ' days')::interval
  group by s.id, s.slug, s.name_en
  order by count(e.id) desc
  limit p_limit;
$$;

create or replace function public.analytics_top_searches(p_days int default 30, p_limit int default 15)
returns table(search_query text, count bigint)
language sql stable
as $$
  select lower(btrim(search_query)), count(*)
  from public.analytics_events
  where event_type = 'search'
    and search_query is not null and btrim(search_query) <> ''
    and created_at >= now() - (p_days || ' days')::interval
  group by lower(btrim(search_query))
  order by count(*) desc
  limit p_limit;
$$;

create or replace function public.analytics_recent_ai_questions(p_limit int default 30)
returns table(ai_question text, locale text, created_at timestamptz)
language sql stable
as $$
  select ai_question, locale, created_at
  from public.analytics_events
  where event_type = 'ai_question' and ai_question is not null
  order by created_at desc
  limit p_limit;
$$;

create or replace function public.analytics_ai_daily(p_days int default 30)
returns table(day date, count bigint)
language sql stable
as $$
  select d::date, count(e.id)
  from generate_series(
         date_trunc('day', now()) - ((p_days - 1) || ' days')::interval,
         date_trunc('day', now()),
         interval '1 day') d
  left join public.analytics_events e
    on e.event_type = 'ai_question'
   and e.created_at >= d and e.created_at < d + interval '1 day'
  group by d
  order by d;
$$;

create or replace function public.analytics_top_countries(p_days int default 30, p_limit int default 12)
returns table(country text, views bigint)
language sql stable
as $$
  select country, count(*)
  from public.analytics_events
  where event_type in ('university_view', 'scholarship_view')
    and country is not null and country <> ''
    and created_at >= now() - (p_days || ' days')::interval
  group by country
  order by count(*) desc
  limit p_limit;
$$;

create or replace function public.analytics_locale_split(p_days int default 30)
returns table(locale text, visits bigint)
language sql stable
as $$
  select coalesce(locale, 'unknown'), count(*)
  from public.analytics_events
  where event_type = 'pageview'
    and created_at >= now() - (p_days || ' days')::interval
  group by coalesce(locale, 'unknown')
  order by count(*) desc;
$$;

create or replace function public.analytics_top_referrers(p_days int default 30, p_limit int default 10)
returns table(referrer text, count bigint)
language sql stable
as $$
  select referrer, count(*)
  from public.analytics_events
  where event_type = 'pageview'
    and referrer is not null and btrim(referrer) <> ''
    and created_at >= now() - (p_days || ' days')::interval
  group by referrer
  order by count(*) desc
  limit p_limit;
$$;

create or replace function public.analytics_engagement(p_days int default 30)
returns json
language sql stable
as $$
  with window_visitors as (
    select visitor_id, count(*) as events
    from public.analytics_events
    where created_at >= now() - (p_days || ' days')::interval
    group by visitor_id
  ),
  first_seen as (
    select visitor_id, min(created_at) as first_at
    from public.analytics_events
    group by visitor_id
  )
  select json_build_object(
    'new_visitors', (
      select count(*) from window_visitors wv
      join first_seen fs on fs.visitor_id = wv.visitor_id
      where fs.first_at >= now() - (p_days || ' days')::interval
    ),
    'returning_visitors', (
      select count(*) from window_visitors wv
      join first_seen fs on fs.visitor_id = wv.visitor_id
      where fs.first_at < now() - (p_days || ' days')::interval
    ),
    'avg_events_per_visitor', (
      select coalesce(round(avg(events), 1), 0) from window_visitors
    )
  );
$$;

create or replace function public.analytics_signups_daily(p_days int default 30)
returns table(day date, signups bigint)
language sql stable
as $$
  select d::date, count(p.id)
  from generate_series(
         date_trunc('day', now()) - ((p_days - 1) || ' days')::interval,
         date_trunc('day', now()),
         interval '1 day') d
  left join public.profiles p
    on p.created_at >= d and p.created_at < d + interval '1 day'
  group by d
  order by d;
$$;

grant execute on function
  public.analytics_summary(),
  public.analytics_visits_daily(int),
  public.analytics_visits_monthly(int),
  public.analytics_top_universities(int, int),
  public.analytics_top_scholarships(int, int),
  public.analytics_top_searches(int, int),
  public.analytics_recent_ai_questions(int),
  public.analytics_ai_daily(int),
  public.analytics_top_countries(int, int),
  public.analytics_locale_split(int),
  public.analytics_top_referrers(int, int),
  public.analytics_engagement(int),
  public.analytics_signups_daily(int)
to service_role;
