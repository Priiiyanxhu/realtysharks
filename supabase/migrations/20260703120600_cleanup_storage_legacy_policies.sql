-- ============================================================================
-- 20260703120600_cleanup_storage_legacy_policies.sql
--
-- Purpose: remove all remaining broad / legacy storage.objects policies that
-- survived earlier migrations (some were created out-of-band in the live
-- Dashboard and are NOT in source control), and re-establish AVATAR policies
-- under clean, owner-folder-scoped names.
--
-- Live pg_policies showed these leftovers still present:
--     Avatar all access                        (ALL / authenticated)  <-- worst
--     Avatar public select
--     Read Own KYC
--     Upload Own KYC
--     Users can update their own KYC documents
--     Users can upload their own KYC documents
--     Users can view their own KYC documents
--
-- "Avatar all access" = FOR ALL TO authenticated USING (bucket_id='avatars'),
-- which lets any authenticated user overwrite/delete any other user's avatar
-- (and, because covers are stored in the avatars bucket as {uid}/cover.ext,
-- any other user's cover too). This migration closes that.
--
-- Path strategy (unchanged app code):
--     avatars/{auth.uid()}/avatar.ext
--     avatars/{auth.uid()}/cover.ext
-- Scoping rule: auth.uid()::text = (storage.foldername(name))[1]
--
-- NON-DESTRUCTIVE: only DROP POLICY IF EXISTS + CREATE POLICY. No buckets,
-- tables, or files are dropped or moved. Idempotent / re-runnable.
--
-- KYC, covers, and listing-images owner-scoped policies from
-- 20260703120200_secure_storage.sql are intentionally LEFT UNTOUCHED.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop remaining broad / legacy AVATAR policies (from migrations AND the
--    out-of-band live policies). We also drop the previous owner-scoped avatar
--    policy names from 20260703000001 so we can re-create them under the new
--    canonical names below without duplication.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Avatar all access" ON storage.objects;                     -- FOR ALL TO authenticated  (critical)
DROP POLICY IF EXISTS "Avatar public select" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can list their own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- ----------------------------------------------------------------------------
-- 2. Drop remaining legacy KYC policies (both the source-controlled names and
--    the out-of-band live "... KYC documents" / "Read/Upload Own KYC" names).
--    The secure kyc_*_own policies remain in place and are the only ones left.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read Own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Upload Own KYC" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own KYC." ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC." ON storage.objects;
DROP POLICY IF EXISTS "KYC all access" ON storage.objects;

-- ----------------------------------------------------------------------------
-- 3. Re-create AVATAR policies, owner-folder scoped (covers avatar + cover
--    files, both stored under avatars/{uid}/...).
--
--    SELECT: the avatars bucket is public = true, so public rendering of
--    avatars already works via the /storage/v1/object/public/ endpoint WITHOUT
--    consulting RLS. Avatars are intentionally-public profile imagery, so we
--    expose a SELECT policy (named *_public_or_own) that lets clients read/list
--    avatar objects for network browsing. This is SELECT-only and scoped to the
--    avatars bucket -- it is NOT a broad FOR ALL grant, and write operations
--    remain strictly owner-scoped below.
-- ----------------------------------------------------------------------------
CREATE POLICY "avatars_select_public_or_own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
);

CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------------------------------------------
-- 4. kyc_*_own, covers_*_own, listing_images_*_own from
--    20260703120200_secure_storage.sql are intentionally NOT modified here.
-- ----------------------------------------------------------------------------
