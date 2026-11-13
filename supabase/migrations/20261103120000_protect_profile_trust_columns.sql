-- ============================================================================
-- 20261103120000_protect_profile_trust_columns.sql
--
-- Problem: the profiles UPDATE/INSERT policies only check row ownership
-- (auth.uid() = id). RLS cannot restrict WHICH COLUMNS a row owner may write, so
-- any logged-in user could run
--     UPDATE profiles SET verified = true, kyc_status = 'approved' ...
-- and self-verify, defeating the "verified broker" trust signal the product
-- sells. They could also rewrite auth_id, the lookup key the app joins on.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that rejects client-role writes to the
-- trust columns. Trusted contexts (service_role, the postgres / supabase_admin
-- owners, and SECURITY DEFINER functions owned by them such as
-- handle_new_user) are unaffected, so a future admin/KYC review flow running
-- server-side with the service_role key keeps working.
--
-- Why a trigger and not column-level GRANTs: the onboarding upsert and the
-- profile page legitimately write kyc_status = 'pending', and PostgREST upserts
-- need UPDATE on every column they set. Revoking column privileges would break
-- those flows; the trigger lets the benign write through and blocks the rest.
--
-- Rules for non-privileged callers (anon / authenticated / any other role):
--   * verified, is_verified : cannot be set to true on INSERT, cannot change on UPDATE.
--   * kyc_status            : may only be set to 'pending' (a KYC re-upload).
--   * auth_id               : must equal id on INSERT; immutable on UPDATE
--                             (a NULL auth_id may be filled in with id).
-- is_verified is a legacy column that may not exist in every environment, so
-- columns are compared through to_jsonb() rather than referenced directly.
--
-- NON-DESTRUCTIVE: no data is rewritten. Idempotent / rerun-safe.
--
-- ROLLOUT NOTE: this does not undo past abuse. Before/after applying, review
-- profiles that are already verified or past 'pending':
--     SELECT id, full_name, agency_name, verified, kyc_status
--       FROM public.profiles
--      WHERE verified IS TRUE OR kyc_status IS DISTINCT FROM 'pending';
-- and reset any you did not personally review.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb := pg_catalog.to_jsonb(NEW);
  v_column text;
BEGIN
  -- Trusted server-side contexts may write anything.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new ->> 'verified' = 'true' OR v_new ->> 'is_verified' = 'true' THEN
      RAISE EXCEPTION 'profiles.verified cannot be set by clients'
        USING ERRCODE = '42501';
    END IF;

    IF v_new ->> 'kyc_status' IS NOT NULL AND v_new ->> 'kyc_status' <> 'pending' THEN
      RAISE EXCEPTION 'profiles.kyc_status cannot be set by clients'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.auth_id IS NULL THEN
      NEW.auth_id := NEW.id;
    ELSIF NEW.auth_id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'profiles.auth_id must equal profiles.id'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  v_old := pg_catalog.to_jsonb(OLD);

  FOREACH v_column IN ARRAY ARRAY['verified', 'is_verified']
  LOOP
    IF (v_old -> v_column) IS DISTINCT FROM (v_new -> v_column) THEN
      RAISE EXCEPTION 'profiles.% cannot be changed by clients', v_column
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF (v_old -> 'kyc_status') IS DISTINCT FROM (v_new -> 'kyc_status')
     AND v_new ->> 'kyc_status' IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'profiles.kyc_status can only be reset to pending by clients'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id
     AND NOT (OLD.auth_id IS NULL AND NEW.auth_id = NEW.id) THEN
    RAISE EXCEPTION 'profiles.auth_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are not meant to be callable directly. (Trigger execution
-- does not require EXECUTE at fire time, so this does not affect clients.)
REVOKE ALL ON FUNCTION public.protect_profile_trust_columns()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_protect_trust_columns ON public.profiles;
CREATE TRIGGER profiles_protect_trust_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_trust_columns();
