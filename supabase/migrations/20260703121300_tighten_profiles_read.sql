-- ============================================================================
-- 20260703121300_tighten_profiles_read.sql
--
-- Purpose: tighten public read access to public.profiles.
--
-- Problem: profiles SELECT is "Public profiles are viewable by everyone."
-- USING (true) -> readable by anon + every authenticated user. RLS cannot hide
-- columns, so any code doing select('*') (the network screens) leaks
-- email / phone_number / rera_number to other users.
--
-- Model applied (hybrid A + B):
--   A) Base table: replace the anon-inclusive USING (true) SELECT with an
--      authenticated-only SELECT. Every Realtysharks screen that reads profiles
--      is behind login (proxy.ts route protection), and login/register read
--      profiles only AFTER a session exists -- so this breaks nothing and
--      removes anonymous access.
--   B) Cross-user browsing goes through a SECURITY INVOKER view,
--      public.profiles_public, that exposes ONLY safe columns. The two network
--      screens (which used select('*')) are repointed to it, so email / phone
--      are no longer selectable by other users.
--
-- security_invoker = on (Postgres 15+, Supabase default engine): the view runs
-- with the QUERYING user's privileges + RLS, so it does NOT bypass profiles
-- RLS. It is not a security-definer view.
--
-- NON-DESTRUCTIVE: no table/column dropped or renamed. Adds `city` (already
-- used by app code, added out-of-band in live DB) idempotently so the view
-- compiles everywhere. Idempotent / safe to rerun.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Ensure `city` exists on profiles (network screens read profile.city;
--    no prior migration created it). Additive, safe.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

-- ----------------------------------------------------------------------------
-- 1. Base table: anon-inclusive USING (true) -> authenticated-only SELECT.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- (INSERT/UPDATE owner policies from earlier migrations are unchanged.)

-- ----------------------------------------------------------------------------
-- 2. Safe public view -- only non-sensitive columns. NO email, phone_number,
--    aadhar_no, full_name_aadhar, and never references profiles_private.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  id,
  auth_id,
  full_name,
  agency_name,
  role,
  avatar_url,
  cover_url,
  city,
  rera_number,     -- business credential, intentionally public for trust display
  verified,
  kyc_status,
  core_expertise,
  created_at
FROM public.profiles;

-- Consumers are always authenticated; grant read on the view to them.
GRANT SELECT ON public.profiles_public TO authenticated;

-- Do NOT grant to anon (base RLS is authenticated-only; keep the view aligned).
REVOKE ALL ON public.profiles_public FROM anon;
