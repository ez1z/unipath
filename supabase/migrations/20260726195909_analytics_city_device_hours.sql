-- Analytics: city-level interest, device split, and peak-hour insight.
-- Adds two denormalized columns and three aggregation RPCs. Same service-role-only
-- access model as the base analytics_events table (no RLS policies).

alter table public.analytics_events add column if not exists city   text;  -- entity city, denormalized (university_view)
alter table public.analytics_events add column if not exists device text;  -- 'mobile' | 'tablet' | 'desktop', parsed from UA server-side

create index if not exists analytics_events_city_idx on public.analytics_events (city) where city is not null;

-- Most-viewed cities. City can repeat across countries, so group with country too.
create or replace function public.analytics_top_cities(p_days int default 30, p_limit int default 12)
returns table(city text, country text, views bigint)
language sql stable
as $$
  select city, country, count(*)
  from public.analytics_events
  where event_type in ('university_view', 'scholarship_view')
    and city is not null and city <> ''
    and created_at >= now() - (p_days || ' days')::interval
  group by city, country
  order by count(*) desc
  limit p_limit;
$$;

-- Pageviews by hour-of-day in Turkmenistan local time (UTC+5) — for ad scheduling.
create or replace function public.analytics_peak_hours(p_days int default 30)
returns table(hour int, visits bigint)
language sql stable
as $$
  select h::int, count(e.id)
  from generate_series(0, 23) h
  left join public.analytics_events e
    on e.event_type = 'pageview'
   and e.created_at >= now() - (p_days || ' days')::interval
   and extract(hour from e.created_at at time zone 'Asia/Ashgabat')::int = h
  group by h
  order by h;
$$;

-- Device mix (mobile / tablet / desktop) across pageviews.
create or replace function public.analytics_device_split(p_days int default 30)
returns table(device text, visits bigint)
language sql stable
as $$
  select coalesce(device, 'unknown'), count(*)
  from public.analytics_events
  where event_type = 'pageview'
    and created_at >= now() - (p_days || ' days')::interval
  group by coalesce(device, 'unknown')
  order by count(*) desc;
$$;

grant execute on function
  public.analytics_top_cities(int, int),
  public.analytics_peak_hours(int),
  public.analytics_device_split(int)
to service_role;
