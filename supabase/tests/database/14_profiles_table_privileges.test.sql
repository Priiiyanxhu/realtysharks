BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(8);

-- The profiles tables state their own grants instead of relying on the
-- platform's default privileges (which current Supabase images no longer give
-- to new tables). RLS still decides which rows a signed-in user can touch.

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS p(privilege_name)
    WHERE pg_catalog.has_table_privilege('authenticated', 'public.profiles', privilege_name)
  ),
  'INSERT,SELECT,UPDATE',
  'authenticated can read, insert and update profiles, and nothing more'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS p(privilege_name)
    WHERE pg_catalog.has_table_privilege('anon', 'public.profiles', privilege_name)
  ),
  NULL,
  'anon has no privileges on profiles'
);

SELECT extensions.ok(
  pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
  AND pg_catalog.has_table_privilege('service_role', 'public.profiles', 'UPDATE'),
  'service_role can read and update profiles (admin review, scripts)'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS p(privilege_name)
    WHERE pg_catalog.has_table_privilege('authenticated', 'public.profiles_private', privilege_name)
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated can manage its own profiles_private row, and nothing more'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS p(privilege_name)
    WHERE pg_catalog.has_table_privilege('anon', 'public.profiles_private', privilege_name)
  ),
  NULL,
  'anon has no privileges on profiles_private'
);

SELECT extensions.ok(
  pg_catalog.has_table_privilege('service_role', 'public.profiles_private', 'SELECT'),
  'service_role can read profiles_private (KYC review)'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.profiles'::pg_catalog.regclass)
  AND (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.profiles_private'::pg_catalog.regclass),
  'RLS stays enabled on both tables, so the grants alone expose no rows'
);

-- A signed-in user still reaches only their own private row.
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000601', 'authenticated', 'authenticated',
   'grants-a-601@example.invalid', '{}'::jsonb, '{"full_name":"Grants A"}'::jsonb,
   pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000602', 'authenticated', 'authenticated',
   'grants-b-602@example.invalid', '{}'::jsonb, '{"full_name":"Grants B"}'::jsonb,
   pg_catalog.now(), pg_catalog.now());

INSERT INTO public.profiles_private (auth_id, aadhar_no)
VALUES ('00000000-0000-4000-8000-000000000601', '000000000601'),
       ('00000000-0000-4000-8000-000000000602', '000000000602');

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000601', true);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.profiles_private),
  1,
  'a signed-in user sees only their own profiles_private row'
);

RESET ROLE;

SELECT * FROM extensions.finish();

ROLLBACK;
