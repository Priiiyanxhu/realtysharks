BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(19);

SELECT extensions.ok(
  pg_catalog.to_regclass('public.profiles') IS NOT NULL,
  'profiles exists'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_row.contype = 'p'
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND attribute.attname = 'id'
  ),
  'profiles.id is the single-column primary key'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::pg_catalog.regclass
      AND attname = 'auth_id'
      AND attnum > 0
      AND NOT attisdropped
  ),
  'profiles.auth_id exists'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = constraint_row.conkey[1]
    WHERE constraint_row.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_row.contype = 'u'
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND attribute.attname = 'auth_id'
  ),
  'profiles.auth_id has a single-column unique constraint'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.prosecdef
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.handle_new_user()'::pg_catalog.regprocedure
  ),
  'handle_new_user is SECURITY DEFINER'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.proconfig = ARRAY['search_path=""']::text[]
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.handle_new_user()'::pg_catalog.regprocedure
  ),
  'handle_new_user has an empty search_path'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'auth.users'::pg_catalog.regclass
      AND trigger_row.tgname = 'on_auth_user_created'
      AND NOT trigger_row.tgisinternal
  ),
  'on_auth_user_created exists on auth.users'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'auth.users'::pg_catalog.regclass
      AND trigger_row.tgname = 'on_auth_user_created'
      AND trigger_row.tgfoid =
        'public.handle_new_user()'::pg_catalog.regprocedure
  ),
  'on_auth_user_created executes public.handle_new_user'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = 'public.profiles_public'::pg_catalog.regclass
      AND relation.relkind = 'v'
  ),
  'profiles_public exists as a view'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles_public'
      AND column_name = 'email'
  ),
  'profiles_public does not expose email'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles_public'
      AND column_name = 'phone_number'
  ),
  'profiles_public does not expose phone_number'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles_public'
      AND column_name = 'aadhar_no'
  ),
  'profiles_public does not expose aadhar_no'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles_public'
      AND column_name = 'full_name_aadhar'
  ),
  'profiles_public does not expose full_name_aadhar'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles_public'
      AND column_name = 'kyc_url'
  ),
  'profiles_public does not expose kyc_url'
);

SELECT extensions.ok(
  (
    SELECT relation.relrowsecurity
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = 'public.profiles_private'::pg_catalog.regclass
  ),
  'profiles_private has RLS enabled'
);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  'authenticated',
  'authenticated',
  'profile-trigger-101@example.invalid',
  '{}'::jsonb,
  '{"full_name":"Replay Profile Test"}'::jsonb,
  pg_catalog.now(),
  pg_catalog.now()
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'signup trigger creates exactly one profile row'
);

SELECT extensions.is(
  (
    SELECT id::text
    FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  '00000000-0000-4000-8000-000000000101',
  'triggered profile id matches the auth user id'
);

SELECT extensions.is(
  (
    SELECT auth_id::text
    FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  '00000000-0000-4000-8000-000000000101',
  'triggered profile auth_id matches the auth user id'
);

SELECT extensions.is(
  (
    SELECT full_name
    FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  'Replay Profile Test',
  'signup trigger copies full_name from raw user metadata'
);

SELECT * FROM extensions.finish();

ROLLBACK;
