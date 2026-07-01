-- Nickname superseded by profiles.display_name — drop the unused columns.
alter table public.profiles
  drop column if exists nickname,
  drop column if exists nickname_prompt_dismissed;
