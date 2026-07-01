-- Nickname + one-time prompt dismissal for discussions.
alter table public.profiles
  add column if not exists nickname text
    constraint profiles_nickname_len
    check (nickname is null or char_length(nickname) between 2 and 30),
  add column if not exists nickname_prompt_dismissed boolean not null default false;
