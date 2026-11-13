-- ============================================================================
-- 20261103120500_scope_avatars_select_to_owner.sql
--
-- Problem: 20260703120600 created
--     avatars_select_public_or_own  FOR SELECT  USING (bucket_id = 'avatars')
-- with no TO clause, so it applies to PUBLIC, including anon. Anyone holding
-- the public anon key could call the Storage list API and enumerate every
-- object in the avatars bucket: every user's id (folder names are auth uids),
-- and every file ever uploaded there, including superseded files (uploading
-- avatar.jpg after avatar.png leaves the old PNG behind) and covers.
-- 20260703000001 had deliberately OMITTED a public SELECT policy for exactly
-- this reason; 20260703120600 reintroduced it "for network browsing".
--
-- That justification does not hold. The avatars bucket is public = true, so the
-- images people see (and that next/image fetches) are served from
-- /storage/v1/object/public/avatars/... WITHOUT consulting RLS. The app only
-- ever calls upload(..., { upsert: true }) and getPublicUrl() on this bucket -
-- never list() or download() - so no client path needs a broad SELECT policy.
--
-- Fix: replace it with an owner-folder SELECT for logged-in users, matching
-- covers / listing-images / kyc-documents (20260703120200). The owner SELECT is
-- required, not optional: Storage's upsert runs INSERT ... ON CONFLICT DO
-- UPDATE, which must be able to read the existing row, so without it
-- re-uploading an avatar or cover would start failing.
--
-- Unchanged: public image rendering by URL, and the avatars_insert_own /
-- update_own / delete_own write policies.
--
-- Safety checks, so this can't silently make things worse or leave the hole:
--   * Aborts if the avatars bucket exists but is NOT public (dropping the broad
--     policy would then break avatar rendering for everyone but the owner).
--   * After the change, aborts if any other SELECT-capable policy on
--     storage.objects is still open to anon/PUBLIC, or any other SELECT/ALL
--     policy mentions avatars without an owner-folder check. This catches
--     policies created out-of-band in the dashboard so they get reviewed.
--
-- NON-DESTRUCTIVE: no bucket or object is touched. Idempotent / rerun-safe.
--
-- NOT fixed here: orphaned superseded avatar/cover files accumulate (the app
-- uploads to avatar.<ext> / cover.<ext>). They are now un-enumerable, but still
-- retrievable by anyone who guesses {uid}/avatar.<other-ext>. Cleaning them up
-- needs an app/job change (delete the old object on upload).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'avatars' AND public IS NOT TRUE
  ) THEN
    RAISE EXCEPTION
      'avatars bucket is not public: removing its broad SELECT policy would break avatar rendering. Review before applying.'
      USING ERRCODE = '55000';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "avatars_select_public_or_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;

CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify nothing else still exposes the bucket.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT pg_catalog.string_agg(policyname, ', ' ORDER BY policyname)
    INTO offending
    FROM pg_catalog.pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND cmd IN ('SELECT', 'ALL')
     AND (
       roles && ARRAY['public', 'anon']::name[]
       OR (
         COALESCE(qual, '') ILIKE '%avatars%'
         AND COALESCE(qual, '') NOT ILIKE '%foldername%'
       )
     );

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'storage.objects still has SELECT-capable policies open to anon/PUBLIC or to the avatars bucket without an owner-folder check: %. Review and drop them, then re-run.',
      offending
      USING ERRCODE = '55000';
  END IF;
END;
$$;
