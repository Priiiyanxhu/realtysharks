-- ============================================================================
-- 20261103120100_secure_requirements_access.sql
--
-- Problem: requirements had a single SELECT policy with no TO clause
--     USING (is_active = true OR auth.uid() = broker_id)
-- so it applied to the anon role too. Combined with Supabase's default table
-- grants, anyone holding the public anon key (it ships in the JS bundle) could
-- list every active requirement WITHOUT logging in: budgets, client_profile,
-- funding_status, timeline and the posting broker's id. The later security
-- migrations tightened listings, profiles and chat but never touched this table.
--
-- Fix (mirrors the listings model from 20260716165127):
--   * Drop every existing requirements policy by catalog identity (including
--     any created out-of-band in the dashboard), then create one canonical
--     policy per operation, all TO authenticated.
--   * Replace inherited/default table grants with exactly what the app needs;
--     anon gets nothing. service_role is untouched.
--
-- Visibility is deliberately UNCHANGED for logged-in users: any authenticated
-- broker may read active requirements (that is the product - matching demand to
-- inventory), and owners may also read their own inactive ones.
--
-- NOT CHANGED, needs a product decision: privacy_level. The app writes
-- 'Standard' or 'Highly Confidential' but nothing enforces it. Making
-- 'Highly Confidential' owner-only would hide VIP requirements from the very
-- brokers they are posted to reach; RLS also cannot hide single columns (e.g.
-- client_profile) while exposing the row. Decide the intended semantics first
-- (hide the row? hide fields via a view? hide only from non-verified brokers?).
--
-- NON-DESTRUCTIVE: no table, column or row is touched. Idempotent / rerun-safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remove every current requirements policy, whatever it is named.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'requirements'
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY IF EXISTS %I ON public.requirements',
      policy_record.policyname
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Canonical policies. No anonymous policy exists.
-- ----------------------------------------------------------------------------
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirements_select_authenticated
  ON public.requirements FOR SELECT
  TO authenticated
  USING (is_active = true OR broker_id = auth.uid());

CREATE POLICY requirements_insert_own
  ON public.requirements FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY requirements_update_own
  ON public.requirements FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY requirements_delete_own
  ON public.requirements FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Grants: the app only ever selects / inserts / updates / deletes through
--    RLS as an authenticated user. Drop everything else (incl. anon, TRUNCATE,
--    REFERENCES, TRIGGER).
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.requirements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.requirements TO authenticated;
