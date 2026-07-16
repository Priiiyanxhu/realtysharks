BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(20);

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
VALUES (
  '00000000-0000-4000-8000-000000000501',
  'authenticated', 'authenticated',
  'storage-user-501@example.invalid', '{}'::jsonb,
  '{"full_name":"Storage Test User"}'::jsonb,
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

RESET ROLE;

SELECT * FROM extensions.finish();

ROLLBACK;
