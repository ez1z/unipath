-- The public homepage's "most visited" sections call these RPCs from the anon-key
-- server client (no PII/write access exposed -- aggregate view counts + public names/slugs only).
grant execute on function public.analytics_top_universities(int, int) to anon, authenticated;
grant execute on function public.analytics_top_scholarships(int, int) to anon, authenticated;
