BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(40);

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'avatars'
), 'avatars bucket exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'covers'
), 'covers bucket exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'kyc-documents'
), 'kyc-documents bucket exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'listing-images'
), 'listing-images bucket exists');

SELECT extensions.ok((
  SELECT public FROM storage.buckets WHERE id = 'avatars'
), 'avatars bucket is public');

SELECT extensions.ok((
  SELECT public FROM storage.buckets WHERE id = 'covers'
), 'covers bucket is public');

SELECT extensions.ok(NOT (
  SELECT public FROM storage.buckets WHERE id = 'kyc-documents'
), 'kyc-documents bucket is private');

SELECT extensions.ok((
  SELECT public FROM storage.buckets WHERE id = 'listing-images'
), 'listing-images bucket is public');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can upload an avatar.'
), 'legacy broad avatar upload policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can update an avatar.'
), 'legacy broad avatar update policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can upload a cover.'
), 'legacy broad cover upload policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can update a cover.'
), 'legacy broad cover update policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Listing image all access'
), 'legacy listing-image all-access policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can upload a listing image.'
), 'legacy broad listing-image upload policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'KYC all access'
), 'legacy KYC all-access policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatar all access'
), 'legacy avatar all-access policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Cover all access'
), 'legacy cover all-access policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatar public select'
), 'legacy avatar public-select policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Cover public select'
), 'legacy cover public-select policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Listing images are publicly accessible.'
), 'legacy listing-image public-select policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatar images are publicly accessible.'
), 'legacy avatar public-image policy is absent');

SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Cover images are publicly accessible.'
), 'legacy cover public-image policy is absent');

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'avatars_insert_own', 'avatars_update_own', 'avatars_delete_own'
      )
  ),
  'avatars_delete_own,avatars_insert_own,avatars_update_own',
  'canonical avatar owner-folder write policies exist'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'covers_insert_own', 'covers_update_own', 'covers_delete_own'
      )
  ),
  'covers_delete_own,covers_insert_own,covers_update_own',
  'canonical cover owner-folder write policies exist'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'kyc_insert_own', 'kyc_update_own', 'kyc_delete_own'
      )
  ),
  'kyc_delete_own,kyc_insert_own,kyc_update_own',
  'canonical KYC owner-folder write policies exist'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'listing_images_insert_own',
        'listing_images_update_own',
        'listing_images_delete_own'
      )
  ),
  'listing_images_delete_own,listing_images_insert_own,listing_images_update_own',
  'canonical listing-image owner-folder write policies exist'
);

INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000501',
    'authenticated', 'authenticated',
    'storage-user-a-501@example.invalid', '{}'::jsonb,
    '{"full_name":"Storage Test User A"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    'authenticated', 'authenticated',
    'storage-user-b-502@example.invalid', '{}'::jsonb,
    '{"full_name":"Storage Test User B"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000501';

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name)
    VALUES (
      'avatars',
      '00000000-0000-4000-8000-000000000501/avatar.png'
    )
  $sql$,
  'authenticated user can insert an avatar in their own folder'
);

SELECT extensions.throws_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name)
    VALUES (
      'avatars',
      '00000000-0000-4000-8000-000000000599/not-owned.png'
    )
  $sql$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'authenticated user cannot insert into another user folder'
);

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name)
    VALUES (
      'kyc-documents',
      '00000000-0000-4000-8000-000000000501/identity.pdf'
    )
  $sql$,
  'user A can insert a KYC object in their own folder'
);

SELECT extensions.throws_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name)
    VALUES (
      'kyc-documents',
      '00000000-0000-4000-8000-000000000502/not-owned.pdf'
    )
  $sql$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'user A cannot insert a KYC object in user B folder'
);

RESET ROLE;

-- Supabase Storage rejects direct SQL deletion unless its API-scoped
-- transaction flag is present. Enable that local-only guard context so the
-- DELETE assertions exercise RLS rather than the built-in statement trigger.
SET LOCAL "storage.allow_delete_query" = 'true';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000502';

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  0::bigint,
  'user B cannot select user A KYC object'
);

SELECT extensions.lives_ok(
  $sql$
    UPDATE storage.objects
       SET metadata = '{"test":"unauthorized"}'::jsonb
     WHERE bucket_id = 'kyc-documents'
       AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  $sql$,
  'user B cross-folder KYC update is safely filtered by RLS'
);

SELECT extensions.lives_ok(
  $sql$
    DELETE FROM storage.objects
     WHERE bucket_id = 'kyc-documents'
       AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  $sql$,
  'user B cross-folder KYC delete is safely filtered by RLS'
);

RESET ROLE;

SELECT extensions.is(
  (
    SELECT metadata ->> 'test'
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  NULL::text,
  'user B cannot change user A KYC object metadata'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  1::bigint,
  'user B cannot delete user A KYC object'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000501';

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  1::bigint,
  'user A can select their own KYC object'
);

SELECT extensions.lives_ok(
  $sql$
    UPDATE storage.objects
       SET metadata = '{"test":"owner"}'::jsonb
     WHERE bucket_id = 'kyc-documents'
       AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  $sql$,
  'user A can issue an update for their own KYC object'
);

RESET ROLE;

SELECT extensions.is(
  (
    SELECT metadata ->> 'test'
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  'owner',
  'user A can update their own KYC object'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000501';

SELECT extensions.lives_ok(
  $sql$
    DELETE FROM storage.objects
     WHERE bucket_id = 'kyc-documents'
       AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  $sql$,
  'user A can issue a delete for their own KYC object'
);

RESET ROLE;

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM storage.objects
    WHERE bucket_id = 'kyc-documents'
      AND name = '00000000-0000-4000-8000-000000000501/identity.pdf'
  ),
  0::bigint,
  'user A can delete their own KYC object'
);

SELECT * FROM extensions.finish();

ROLLBACK;
