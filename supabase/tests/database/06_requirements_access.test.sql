BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(19);

-- ---------------------------------------------------------------------------
-- Policies: exactly the four canonical ones, none reachable by anon
-- ---------------------------------------------------------------------------
SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'requirements'
  ),
  'requirements_delete_own,requirements_insert_own,requirements_select_own,requirements_update_own',
  'requirements has exactly its four canonical policies'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'requirements'
      AND roles IS DISTINCT FROM ARRAY['authenticated']::name[]
  ),
  'every requirements policy is limited to the authenticated role'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.requirements'::pg_catalog.regclass),
  'RLS is enabled on requirements'
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (
      VALUES
        ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
        ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
    ) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(
      'anon', 'public.requirements', privilege_name
    )
  ),
  NULL::text,
  'anon has no requirements table privileges'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (
      VALUES
        ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
        ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
    ) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(
      'authenticated', 'public.requirements', privilege_name
    )
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated has only SELECT, INSERT, UPDATE, DELETE on requirements'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000511', 'authenticated', 'authenticated',
   'req-alice-511@example.invalid', '{}'::jsonb,
   '{"full_name":"Req Alice"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000512', 'authenticated', 'authenticated',
   'req-bob-512@example.invalid', '{}'::jsonb,
   '{"full_name":"Req Bob"}'::jsonb, pg_catalog.now(), pg_catalog.now());

INSERT INTO public.requirements
  (id, broker_id, property_type, city, client_profile, funding_status,
   is_active, privacy_level)
VALUES
  ('00000000-0000-4000-8000-000000000521',
   '00000000-0000-4000-8000-000000000512', 'Apartment', 'Mumbai',
   'HNI client', 'cash ready', true, 'Highly Confidential'),
  ('00000000-0000-4000-8000-000000000522',
   '00000000-0000-4000-8000-000000000512', 'Villa', 'Pune',
   'Family', 'loan', false, 'Standard'),
  ('00000000-0000-4000-8000-000000000523',
   '00000000-0000-4000-8000-000000000511', 'Office', 'Delhi',
   'Startup', 'cash ready', false, 'Standard');

-- ---------------------------------------------------------------------------
-- Anonymous callers: no access at all
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT * FROM public.requirements$$,
  '42501', NULL,
  'anon cannot read requirements'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.requirements (broker_id, city)
    VALUES ('00000000-0000-4000-8000-000000000512', 'X')$$,
  '42501', NULL,
  'anon cannot insert requirements'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Alice (authenticated)
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000511';

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(id::text, ',' ORDER BY id)
     FROM public.requirements),
  '00000000-0000-4000-8000-000000000523',
  'Alice reads only her own requirements (active or not) from the base table; others are read via requirements_feed'
);

SELECT extensions.lives_ok(
  $$INSERT INTO public.requirements (broker_id, city, is_active)
    VALUES ('00000000-0000-4000-8000-000000000511', 'Chennai', true)$$,
  'Alice can post a requirement as herself'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.requirements (broker_id, city, is_active)
    VALUES ('00000000-0000-4000-8000-000000000512', 'Chennai', true)$$,
  '42501', NULL,
  'Alice cannot post a requirement as Bob'
);

SELECT extensions.lives_ok(
  $$UPDATE public.requirements SET city = 'Delhi NCR'
     WHERE id = '00000000-0000-4000-8000-000000000523'$$,
  'Alice can update her own requirement'
);

SELECT extensions.throws_ok(
  $$UPDATE public.requirements
       SET broker_id = '00000000-0000-4000-8000-000000000512'
     WHERE id = '00000000-0000-4000-8000-000000000523'$$,
  '42501', NULL,
  'Alice cannot hand her requirement to another broker'
);

-- Rows Alice cannot see/write are silently skipped by RLS: the statements
-- succeed but affect nothing (verified below as postgres).
SELECT extensions.lives_ok(
  $$UPDATE public.requirements SET city = 'Hijacked'
     WHERE id = '00000000-0000-4000-8000-000000000521'$$,
  'Alice''s update aimed at Bob''s requirement is a no-op, not an error'
);

SELECT extensions.lives_ok(
  $$DELETE FROM public.requirements
     WHERE id = '00000000-0000-4000-8000-000000000521'$$,
  'Alice''s delete aimed at Bob''s requirement is a no-op, not an error'
);

SELECT extensions.throws_ok(
  $$TRUNCATE public.requirements$$,
  '42501', NULL,
  'authenticated users cannot truncate requirements'
);

SELECT extensions.lives_ok(
  $$DELETE FROM public.requirements
     WHERE id = '00000000-0000-4000-8000-000000000523'$$,
  'Alice can delete her own requirement'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Bob's data was untouched by Alice's attempts
-- ---------------------------------------------------------------------------
SELECT extensions.is(
  (SELECT city FROM public.requirements
    WHERE id = '00000000-0000-4000-8000-000000000521'),
  'Mumbai',
  'Bob''s requirement is unchanged'
);

SELECT extensions.ok(
  (SELECT pg_catalog.count(*) = 1 FROM public.requirements
    WHERE id = '00000000-0000-4000-8000-000000000521'),
  'Bob''s requirement still exists'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.requirements
     WHERE id = '00000000-0000-4000-8000-000000000523'
  ),
  'Alice''s own requirement was deleted'
);

SELECT * FROM extensions.finish();

ROLLBACK;
