-- ============================================================================
-- 20260703121400_move_contact_to_profiles_private.sql
--
-- Purpose: move semi-private contact fields (email, phone_number) out of the
-- authenticated-readable public.profiles table into the owner-only
-- public.profiles_private table, so they are no longer visible to every
-- logged-in broker via a raw select('*') on profiles.
--
-- Scope:
--   * Add email + phone_number to profiles_private.
--   * Backfill from profiles -> profiles_private (COALESCE, rerun-safe).
--   * NULL OUT email + phone_number in public.profiles (columns KEPT).
--
-- profiles_private already has owner-only RLS (SELECT/INSERT/UPDATE/DELETE
-- gated on auth.uid() = auth_id) from 20260703121200; the new columns inherit
-- that table-level RLS automatically, so email / phone_number / aadhar_no /
-- full_name_aadhar are all owner-only.
--
-- NON-DESTRUCTIVE: no table/column dropped or renamed. Idempotent / rerun-safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add contact columns to the private table
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS phone_number text;

-- ----------------------------------------------------------------------------
-- 2. Backfill from profiles (only rows with a value; never clobber with nulls)
--    Guarded so it runs only if the source columns still exist in profiles.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'email'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'phone_number'
  ) THEN
    EXECUTE '
      INSERT INTO public.profiles_private (auth_id, email, phone_number)
      SELECT p.auth_id, p.email, p.phone_number
        FROM public.profiles p
       WHERE p.auth_id IS NOT NULL
         AND (p.email IS NOT NULL OR p.phone_number IS NOT NULL)
      ON CONFLICT (auth_id) DO UPDATE
        SET email        = COALESCE(EXCLUDED.email,        public.profiles_private.email),
            phone_number = COALESCE(EXCLUDED.phone_number, public.profiles_private.phone_number),
            updated_at   = now()
    ';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Drop NOT NULL on the public contact columns so they can be nulled out.
--    The live profiles.email column is NOT NULL; clearing it fails otherwise.
--    DROP NOT NULL is idempotent (no-op if already nullable). email provably
--    exists; phone_number is guarded in case it is absent in some envs.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'email'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'phone_number'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN phone_number DROP NOT NULL';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Clear the relocated contact fields from public.profiles (columns KEPT)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'email'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'phone_number'
  ) THEN
    EXECUTE '
      UPDATE public.profiles
         SET email = NULL,
             phone_number = NULL
       WHERE email IS NOT NULL
          OR phone_number IS NOT NULL
    ';
  END IF;
END $$;
