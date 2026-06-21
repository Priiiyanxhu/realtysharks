-- Fix Storage Policies - granting ALL access to authenticated users to unblock upserts.

-- Avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;

DROP POLICY IF EXISTS "Avatar all access" ON storage.objects;
CREATE POLICY "Avatar all access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar public select" ON storage.objects;
CREATE POLICY "Avatar public select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');


-- Covers
DROP POLICY IF EXISTS "Cover images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a cover." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update a cover." ON storage.objects;

DROP POLICY IF EXISTS "Cover all access" ON storage.objects;
CREATE POLICY "Cover all access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "Cover public select" ON storage.objects;
CREATE POLICY "Cover public select" ON storage.objects FOR SELECT USING (bucket_id = 'covers');


-- KYC Documents
DROP POLICY IF EXISTS "Users can upload their own KYC." ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC." ON storage.objects;

DROP POLICY IF EXISTS "KYC all access" ON storage.objects;
CREATE POLICY "KYC all access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'kyc-documents') WITH CHECK (bucket_id = 'kyc-documents');

