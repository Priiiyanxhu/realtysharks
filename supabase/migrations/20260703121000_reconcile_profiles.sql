-- ============================================================================
-- 20260703121000_reconcile_profiles.sql
--
-- Purpose: make the committed schema reproduce the LIVE profiles table that the
-- app actually reads/writes. The app consistently uses columns that no
-- migration ever created (auth_id, agency_name, verified, kyc_status,
-- onboarded, phone_number, email, core_expertise, aadhar_no, full_name_aadhar).
-- These were added out-of-band in the live DB; this migration source-controls
-- them.
--
-- NON-DESTRUCTIVE:
--   * ADD COLUMN IF NOT EXISTS only. No column is dropped or renamed.
--   * Legacy columns (company_name, is_verified, kyc_url) are KEPT.
--   * auth_id is NOT renamed to id; agency_name is NOT renamed to company_name.
--   * Backfills only touch rows where the new column IS NULL (idempotent).
--
-- Key relationships preserved:
--   * profiles PK stays `id` (= auth.users.id).
--   * `auth_id` mirrors `id` and is what app queries use as the lookup key
--     (dashboard/profile/network/GlobalLayout .eq('auth_id', user.id)) and what
--     public.listings.broker_id references (REFERENCES profiles(auth_id)).
--     -> auth_id must be UNIQUE for that FK to be valid; added below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the columns the app expects (keep all legacy columns intact)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_id          uuid,
  ADD COLUMN IF NOT EXISTS agency_name      text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS phone_number     text,
  ADD COLUMN IF NOT EXISTS verified         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_status       text    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarded        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS core_expertise   text[],
  ADD COLUMN IF NOT EXISTS aadhar_no        text,
  ADD COLUMN IF NOT EXISTS full_name_aadhar text;

-- ----------------------------------------------------------------------------
-- 2. Safe backfills (only where the new column is still NULL)
-- ----------------------------------------------------------------------------
-- auth_id mirrors the PK for every existing row.
UPDATE public.profiles
   SET auth_id = id
 WHERE auth_id IS NULL;

-- Carry any legacy company_name forward into agency_name (do not drop either).
-- Legacy `company_name` may not exist in the live DB, so guard the reference.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'company_name'
  ) THEN
    EXECUTE '
      UPDATE public.profiles
         SET agency_name = company_name
       WHERE agency_name IS NULL
         AND company_name IS NOT NULL
    ';
  END IF;
END $$;

-- Carry legacy is_verified forward into verified.
-- Live DB already has `verified` and does NOT have `is_verified`, so guard it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_verified'
  ) THEN
    EXECUTE '
      UPDATE public.profiles
         SET verified = is_verified
       WHERE verified IS NULL
         AND is_verified IS NOT NULL
    ';
  END IF;
END $$;

-- If a legacy KYC file was recorded, treat status as 'pending' review;
-- otherwise leave the column default. (No PII inference.)
UPDATE public.profiles
   SET kyc_status = 'pending'
 WHERE kyc_status IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Constraints & indexes
--    auth_id must be UNIQUE so listings.broker_id -> profiles(auth_id) is a
--    valid FK target. Guarded so the migration is re-runnable.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_auth_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_id_key UNIQUE (auth_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS profiles_auth_id_idx ON public.profiles (auth_id);
