BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(16);

-- ---------------------------------------------------------------------------
-- Privileges: service_role only
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  pg_catalog.has_function_privilege(
    'service_role', 'public.list_orphaned_avatar_objects(interval)', 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'anon', 'public.list_orphaned_avatar_objects(interval)', 'EXECUTE'
  )
  AND NOT pg_catalog.has_function_privilege(
    'authenticated', 'public.list_orphaned_avatar_objects(interval)', 'EXECUTE'
  ),
  'only service_role can execute list_orphaned_avatar_objects'
);

-- ---------------------------------------------------------------------------
-- Fixtures
--   U1 (581): avatar.png + cover.jpg are current; avatar.jpg + cover.png are
--             superseded; avatar.webp is superseded but only 1 hour old.
--   U2 (582): no avatar_url at all, one file on disk.
--   U4 (584): current avatar referenced with a ?query on a different host/path.
--   583     : no profile (deleted user) but a file remains.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'orphan-' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'Orphan ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM (VALUES (581), (582), (584)) AS v(n);

UPDATE public.profiles
   SET avatar_url = 'https://abc.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000581/avatar.png',
       cover_url  = 'https://abc.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000581/cover.jpg'
 WHERE id = '00000000-0000-4000-8000-000000000581';

UPDATE public.profiles
   SET avatar_url = 'https://other.example.co/storage/v1/render/image/public/avatars/00000000-0000-4000-8000-000000000584/avatar.png?t=123'
 WHERE id = '00000000-0000-4000-8000-000000000584';

INSERT INTO storage.objects (bucket_id, name)
VALUES
  ('avatars', '00000000-0000-4000-8000-000000000581/avatar.png'),
  ('avatars', '00000000-0000-4000-8000-000000000581/avatar.jpg'),
  ('avatars', '00000000-0000-4000-8000-000000000581/avatar.webp'),
  ('avatars', '00000000-0000-4000-8000-000000000581/cover.jpg'),
  ('avatars', '00000000-0000-4000-8000-000000000581/cover.png'),
  ('avatars', '00000000-0000-4000-8000-000000000581/.emptyFolderPlaceholder'),
  ('avatars', '00000000-0000-4000-8000-000000000582/avatar.png'),
  ('avatars', '00000000-0000-4000-8000-000000000583/avatar.png'),
  ('avatars', '00000000-0000-4000-8000-000000000584/avatar.png'),
  ('avatars', 'stray.png'),
  ('listing-images', '00000000-0000-4000-8000-000000000581/photo.jpg');

-- Everything is three days old, except one fresh object.
UPDATE storage.objects
   SET created_at = pg_catalog.now() - interval '3 days',
       updated_at = pg_catalog.now() - interval '3 days';

UPDATE storage.objects
   SET created_at = pg_catalog.now() - interval '1 hour',
       updated_at = pg_catalog.now() - interval '1 hour'
 WHERE name = '00000000-0000-4000-8000-000000000581/avatar.webp';

-- ---------------------------------------------------------------------------
-- Client roles cannot call it at all
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT * FROM public.list_orphaned_avatar_objects()$$,
  '42501', NULL,
  'anon cannot call list_orphaned_avatar_objects'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000581';

SELECT extensions.throws_ok(
  $$SELECT * FROM public.list_orphaned_avatar_objects()$$,
  '42501', NULL,
  'authenticated users cannot call list_orphaned_avatar_objects'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Detection (as service_role)
-- ---------------------------------------------------------------------------
SET LOCAL ROLE service_role;

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(name, ',' ORDER BY name)
     FROM public.list_orphaned_avatar_objects()),
  '00000000-0000-4000-8000-000000000581/avatar.jpg,00000000-0000-4000-8000-000000000581/cover.png,00000000-0000-4000-8000-000000000582/avatar.png,00000000-0000-4000-8000-000000000583/avatar.png,stray.png',
  'default call lists exactly the superseded / unowned / unreferenced files'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects()
    WHERE name IN (
      '00000000-0000-4000-8000-000000000581/avatar.png',
      '00000000-0000-4000-8000-000000000581/cover.jpg'
    )
  ),
  'a profile''s current avatar and cover are never listed'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000584/avatar.png'
  ),
  'a current avatar referenced via another host and a ?query string is not listed'
);

SELECT extensions.is(
  (SELECT reason FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000583/avatar.png'),
  'owner profile does not exist',
  'a file in a deleted user''s folder is reported as unowned'
);

SELECT extensions.is(
  (SELECT reason FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000581/avatar.jpg'),
  'not referenced by profile avatar_url or cover_url',
  'a superseded file is reported as unreferenced'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects(interval '0 seconds')
    WHERE name LIKE '%.emptyFolderPlaceholder'
  ),
  'dashboard folder placeholders are never listed'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects(interval '0 seconds')
    WHERE name LIKE '%photo.jpg'
  ),
  'objects in other buckets are never listed'
);

-- Age guard: protects an upload whose profile update has not landed yet.
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000581/avatar.webp'
  ),
  'a recently written unreferenced file is protected by the default 24h guard'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects(interval '10 minutes')
    WHERE name = '00000000-0000-4000-8000-000000000581/avatar.webp'
  ),
  'a shorter p_min_age includes it once it is older than that'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(DISTINCT bucket_object_count)::int
     FROM public.list_orphaned_avatar_objects()),
  1,
  'bucket_object_count is the same on every row'
);

SELECT extensions.is(
  (SELECT max(bucket_object_count) FROM public.list_orphaned_avatar_objects()),
  (SELECT pg_catalog.count(*) FROM storage.objects WHERE bucket_id = 'avatars'),
  'bucket_object_count equals the real number of avatars objects'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- A user switches file type: the new file becomes current, the old one orphan.
-- ---------------------------------------------------------------------------
UPDATE public.profiles
   SET avatar_url = 'https://abc.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000581/avatar.jpg'
 WHERE id = '00000000-0000-4000-8000-000000000581';

SET LOCAL ROLE service_role;

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000581/avatar.png'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.list_orphaned_avatar_objects()
    WHERE name = '00000000-0000-4000-8000-000000000581/avatar.jpg'
  ),
  'after switching avatar.png -> avatar.jpg, the PNG is orphaned and the JPG is current'
);

RESET ROLE;

-- Detection is read-only.
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM storage.objects),
  11,
  'listing orphans never changes storage.objects'
);

SELECT * FROM extensions.finish();

ROLLBACK;
