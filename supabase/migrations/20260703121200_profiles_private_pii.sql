-- ============================================================================
-- 20260703121200_profiles_private_pii.sql
--
-- Purpose: move Aadhaar / KYC PII out of the world-readable public.profiles
-- table (SELECT policy is USING (true) -> RLS cannot hide columns, so any
-- readable profile row leaks aadhar_no / full_name_aadhar). This migration
-- relocates that PII into an owner-only public.profiles_private table.
--
-- Scope of THIS migration:
--   * Create profiles_private (owner-only RLS).
--   * Backfill existing PII from profiles -> profiles_private.
--   * NULL OUT the PII columns in public.profiles (columns are KEPT, not
--     dropped, per instruction).
--
-- NON-DESTRUCTIVE to structure: no table/column dropped, no rename. The only
-- data mutation is (a) copying PII into the private table and (b) nulling the
-- now-relocated PII in the public table. Idempotent / safe to rerun.
--
-- kyc_document_url is intentionally OMITTED: the app stores KYC files at a
-- fixed storage path (kyc-documents/{uid}/kyc_document.ext) and never persists
-- a URL column, so there is nothing to store here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Private PII table (1:1 with profiles via auth_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles_private (
  auth_id          uuid PRIMARY KEY
                   REFERENCES public.profiles(auth_id) ON DELETE CASCADE,
  aadhar_no        text,
  full_name_aadhar text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Owner-only RLS. No public access, no USING (true), no admin/role policy.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_private_select_own" ON public.profiles_private;
CREATE POLICY "profiles_private_select_own"
  ON public.profiles_private FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "profiles_private_insert_own" ON public.profiles_private;
CREATE POLICY "profiles_private_insert_own"
  ON public.profiles_private FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "profiles_private_update_own" ON public.profiles_private;
CREATE POLICY "profiles_private_update_own"
  ON public.profiles_private FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "profiles_private_delete_own" ON public.profiles_private;
CREATE POLICY "profiles_private_delete_own"
  ON public.profiles_private FOR DELETE
  TO authenticated
  USING (auth.uid() = auth_id);

-- keep updated_at fresh. handle_updated_at() was declared in
-- 20260703000000_create_business_tables.sql, but the live DB diverged and may
-- not have it -- so define it here (idempotently) to keep this migration
-- self-contained. CREATE OR REPLACE is safe if it already exists.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_private_updated_at ON public.profiles_private;
CREATE TRIGGER set_profiles_private_updated_at
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Backfill existing PII into the private table (only rows that have any).
--    Guarded so it runs only if the legacy PII columns still exist in profiles.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'aadhar_no'
  ) THEN
    EXECUTE '
      INSERT INTO public.profiles_private (auth_id, aadhar_no, full_name_aadhar)
      SELECT p.auth_id, p.aadhar_no, p.full_name_aadhar
        FROM public.profiles p
       WHERE p.auth_id IS NOT NULL
         AND (p.aadhar_no IS NOT NULL OR p.full_name_aadhar IS NOT NULL)
      ON CONFLICT (auth_id) DO UPDATE
        SET aadhar_no        = COALESCE(EXCLUDED.aadhar_no, public.profiles_private.aadhar_no),
            full_name_aadhar = COALESCE(EXCLUDED.full_name_aadhar, public.profiles_private.full_name_aadhar),
            updated_at       = now()
    ';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Clear the relocated PII from the public table (columns KEPT, values NULLed)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'aadhar_no'
  ) THEN
    EXECUTE '
      UPDATE public.profiles
         SET aadhar_no = NULL,
             full_name_aadhar = NULL
       WHERE aadhar_no IS NOT NULL
          OR full_name_aadhar IS NOT NULL
    ';
  END IF;
END $$;
