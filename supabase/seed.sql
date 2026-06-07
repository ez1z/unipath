-- Test admin user for E2E tests
-- Credentials: admin@test.local / TestPassword123!
do $$
declare
  v_admin_id uuid := '00000000-0000-0000-0000-000000000099';
begin
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  ) values (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@test.local',
    crypt('TestPassword123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false, 'authenticated', 'authenticated'
  ) on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_admin_id::text,
    v_admin_id,
    format('{"sub":"%s","email":"admin@test.local"}', v_admin_id)::jsonb,
    'email',
    now(), now(), now()
  ) on conflict do nothing;

  insert into public.admins (user_id)
  values (v_admin_id)
  on conflict do nothing;
end;
$$;

-- Test universities for public page E2E tests
insert into public.universities
  (name_en, name_ru, name_tk, country, city, tuition_usd, moe_approved, languages, majors, official_website, application_portal_url)
values
  ('MIT', 'МИТ', 'MIT', 'USA', 'Cambridge', 15000, true,
   ARRAY['English'], ARRAY['Engineering', 'Computer Science'],
   'https://mit.edu', 'https://apply.mit.edu'),
  ('Moscow State University', 'МГУ', 'MGU', 'Russia', 'Moscow', 5000, true,
   ARRAY['Russian'], ARRAY['Medicine', 'Law'],
   'https://msu.ru', 'https://apply.msu.ru')
on conflict (name_en) do nothing;
