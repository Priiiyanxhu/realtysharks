-- Add missing columns to the profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS rera_number TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'broker',
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_url TEXT;

-- Also ensure the RLS policy for insert/upsert exists
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Make sure authenticated users can select
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );
