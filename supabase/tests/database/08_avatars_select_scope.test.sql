BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(13);

-- ---------------------------------------------------------------------------
-- Policy structure
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_select_public_or_own'
  ),
  'the broad avatars_select_public_or_own policy is gone'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(roles::text, ',')
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_select_own'
  ),
  '{authenticated}',
  'avatars_select_own exists and is limited to the authenticated role'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('SELECT', 'ALL')
      AND roles && ARRAY['public', 'anon']::name[]
  ),
  'no SELECT-capable storage.objects policy is open to anon or PUBLIC'
);

SELECT extensions.ok(
  (SELECT public FROM storage.buckets WHERE id = 'avatars'),
  'the avatars bucket is still public (images render by URL without RLS)'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000561', 'authenticated', 'authenticated',
   'av-alice-561@example.invalid', '{}'::jsonb,
   '{"full_name":"Av Alice"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000562', 'authenticated', 'authenticated',
   'av-bob-562@example.invalid', '{}'::jsonb,
   '{"full_name":"Av Bob"}'::jsonb, pg_catalog.now(), pg_catalog.now());

INSERT INTO storage.objects (bucket_id, name)
VALUES
  ('avatars', '00000000-0000-4000-8000-000000000561/avatar.png'),
  ('avatars', '00000000-0000-4000-8000-000000000561/cover.jpg'),
  ('avatars', '00000000-0000-4000-8000-000000000562/avatar.png');

-- ---------------------------------------------------------------------------
-- Anonymous: cannot enumerate the bucket
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM storage.objects
    WHERE bucket_id = 'avatars'),
  0,
  'anon cannot list any avatars objects'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Alice: sees only her own folder
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000561';

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(name, ',' ORDER BY name)
     FROM storage.objects WHERE bucket_id = 'avatars'),
  '00000000-0000-4000-8000-000000000561/avatar.png,00000000-0000-4000-8000-000000000561/cover.jpg',
  'Alice lists only her own avatar and cover'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name LIKE '00000000-0000-4000-8000-000000000562/%'),
  0,
  'Alice cannot see Bob''s avatar object'
);

-- The exact shape of Storage's upload(..., { upsert: true }): it must still be
-- able to read the existing row to update it.
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    VALUES ('avatars', '00000000-0000-4000-8000-000000000561/avatar.png')
    ON CONFLICT (bucket_id, name)
    DO UPDATE SET updated_at = pg_catalog.now()$$,
  'Alice can re-upload (upsert) her own avatar'
);

SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    VALUES ('avatars', '00000000-0000-4000-8000-000000000561/avatar.webp')
    ON CONFLICT (bucket_id, name)
    DO UPDATE SET updated_at = pg_catalog.now()$$,
  'Alice can upsert a first-time avatar in her own folder'
);

SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name)
    VALUES ('avatars', '00000000-0000-4000-8000-000000000562/avatar.png')
    ON CONFLICT (bucket_id, name)
    DO UPDATE SET updated_at = pg_catalog.now()$$,
  '42501', NULL,
  'Alice cannot upsert over Bob''s avatar'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Bob is unaffected by Alice's attempts
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000562';

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(name, ',' ORDER BY name)
     FROM storage.objects WHERE bucket_id = 'avatars'),
  '00000000-0000-4000-8000-000000000562/avatar.png',
  'Bob lists only his own avatar'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name = '00000000-0000-4000-8000-000000000562/avatar.png'),
  1,
  'Bob''s avatar object still exists'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name LIKE '00000000-0000-4000-8000-000000000561/%'),
  3,
  'Alice''s folder holds her original two files plus the new upsert'
);

SELECT * FROM extensions.finish();

ROLLBACK;
