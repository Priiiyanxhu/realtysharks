-- ==========================================
-- REALTYSHARKS SUPABASE INITIALIZATION SCRIPT
-- ==========================================
-- Instructions: Run this script in the SQL Editor of your Supabase Dashboard.

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  company_name text,
  rera_number text,
  role text,
  avatar_url text,
  cover_url text,
  kyc_url text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Create the Trigger for new user signups
-- This automatically creates a profile row when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;

-- 4. Storage RLS Policies
-- Avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
CREATE POLICY "Anyone can update an avatar." ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- Covers
DROP POLICY IF EXISTS "Cover images are publicly accessible." ON storage.objects;
CREATE POLICY "Cover images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Anyone can upload a cover." ON storage.objects;
CREATE POLICY "Anyone can upload a cover." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "Anyone can update a cover." ON storage.objects;
CREATE POLICY "Anyone can update a cover." ON storage.objects FOR UPDATE USING (bucket_id = 'covers');

-- KYC Documents (Private, only owner can view/upload)
DROP POLICY IF EXISTS "Users can upload their own KYC." ON storage.objects;
CREATE POLICY "Users can upload their own KYC." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can view their own KYC." ON storage.objects;
CREATE POLICY "Users can view their own KYC." ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND auth.uid() = owner);
