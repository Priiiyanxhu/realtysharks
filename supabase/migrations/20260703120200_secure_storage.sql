-- ============================================================================
-- 20260703120200_secure_storage.sql
-- URGENT beta blocker: replace broad storage.objects policies with
-- user-folder-scoped RLS for the kyc-documents, covers, and listing-images
-- buckets.
--
-- Root problem (from the security reconciliation audit):
--   20260616184500_fix_storage.sql and 20260616194000_create_listings.sql
--   created policies of the form:
--       FOR ALL TO authenticated USING (bucket_id = '<bucket>')
--   This lets ANY authenticated user read / overwrite / delete ANY other
--   user's objects in that bucket. For the PRIVATE kyc-documents bucket this
--   is a critical PII leak (Aadhaar / PAN / KYC files).
--
-- Path strategy enforced (matches the existing app upload code, unchanged):
--   kyc-documents/{auth.uid()}/kyc_document.ext   (onboarding + profile)
--   listing-images/{auth.uid()}/<random>.ext      (post-listing)
--   covers/{auth.uid()}/...                        (bucket currently unused by
--                                                    app code; covers are stored
--                                                    in the avatars bucket per
--                                                    Option A -- hardened anyway)
--
-- Scoping rule (same pattern already applied to avatars in
-- 20260703000001_fix_avatar_storage.sql):
--       auth.uid()::text = (storage.foldername(name))[1]
--
-- NON-DESTRUCTIVE: only DROP POLICY IF EXISTS + CREATE POLICY. No buckets,
-- tables, or files are dropped or moved. Idempotent / re-runnable.
--
-- NOTE ON PUBLIC READS: `covers` and `listing-images` buckets were created
-- with public = true, so their objects are served via the
-- /storage/v1/object/public/ endpoint WITHOUT consulting RLS. Public
-- rendering of listing images and covers therefore continues to work with NO
-- public SELECT policy. We intentionally omit public SELECT policies so that
-- authenticated .list()/enumeration is restricted to a user's own folder,
-- exactly as done for avatars. `kyc-documents` is private -> no public reads.
--
-- ADMIN / KYC REVIEW: no admin role system exists (the profiles.role column is
-- a self-selected free-text label and MUST NOT be treated as authority).
-- KYC review, when built, must go through a trusted server context using the
-- service_role key -- NOT via an RLS policy. No admin policies are created here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. KYC DOCUMENTS (private bucket) -- owner-folder scoped, no public access
-- ----------------------------------------------------------------------------

-- Drop every known prior kyc-documents policy (broad + legacy owner-based).
DROP POLICY IF EXISTS "KYC all access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own KYC." ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC." ON storage.objects;

CREATE POLICY "kyc_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "kyc_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "kyc_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "kyc_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------------------------------------------
-- 2. COVERS (public bucket, currently unused by app -- Option A) -- hardened
--    Public rendering still works via the public object endpoint (bucket is
--    public); authenticated write/list is restricted to the owner's folder.
-- ----------------------------------------------------------------------------

-- Drop every known prior covers policy (broad + legacy).
DROP POLICY IF EXISTS "Cover all access" ON storage.objects;
DROP POLICY IF EXISTS "Cover public select" ON storage.objects;
DROP POLICY IF EXISTS "Cover images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a cover." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update a cover." ON storage.objects;

CREATE POLICY "covers_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "covers_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "covers_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "covers_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------------------------------------------
-- 3. LISTING IMAGES (public bucket) -- owner-folder scoped writes.
--    App already uploads to `{auth.uid()}/<file>` (post-listing/page.tsx),
--    so this scoping requires NO frontend change. Public rendering of listing
--    images continues via the public object endpoint (bucket is public).
-- ----------------------------------------------------------------------------

-- Drop every known prior listing-images policy (broad + legacy open upload).
DROP POLICY IF EXISTS "Listing image all access" ON storage.objects;
DROP POLICY IF EXISTS "Listing images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a listing image." ON storage.objects;

CREATE POLICY "listing_images_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "listing_images_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "listing_images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'listing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "listing_images_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------------------------------------------
-- 4. AVATARS -- intentionally left UNCHANGED.
--    20260703000001_fix_avatar_storage.sql already enforces owner-folder
--    scoping (SELECT/INSERT/UPDATE/DELETE gated on
--    auth.uid()::text = (storage.foldername(name))[1] with a safe-extension
--    allowlist). Covers are stored under the avatars bucket as
--    `{uid}/cover.ext` (Option A) and are correctly covered by those policies.
--    No avatar changes are made here to avoid weakening a working control.
-- ----------------------------------------------------------------------------
