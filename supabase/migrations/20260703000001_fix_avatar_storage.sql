-- Fix Avatar Storage Security Migration
-- 1. Drops old overly-broad policies
-- 2. Restricts bucket access to authenticated users acting strictly within their auth.uid() folder
-- 3. Enforces safe image extensions

-- Drop ALL old policies known from previous migrations
DROP POLICY IF EXISTS "Avatar all access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public select" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;

-- NOTE: The 'avatars' bucket was created with `public = true`. 
-- Because of this, public avatars are served directly by Supabase via the `/storage/v1/object/public/` endpoint without checking RLS.
-- Therefore, we intentionally OMIT a public SELECT policy to prevent random users from calling `.list()` to enumerate the entire bucket.
-- If an authenticated user needs to list their own files in the future, they can do so with this restricted SELECT:
CREATE POLICY "Users can list their own avatar folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: INSERT
-- Users can only upload if the first folder in the path matches their UUID, and it's a safe image extension.
CREATE POLICY "Users can upload to their own avatar folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

-- Policy: UPDATE
-- Users can only update their own files, and they cannot rename/move the file to another user's folder.
CREATE POLICY "Users can update their own avatars"
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

-- Policy: DELETE
-- Users can only delete their own files.
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
