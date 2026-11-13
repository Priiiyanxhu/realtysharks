-- ============================================================================
-- 20261103120300_requirements_base_select_owner_only.sql   (rollout phase 2 of 2)
--
-- >>> DO NOT APPLY until the frontend that reads other users' requirements from
-- >>> public.requirements_feed (see 20261103120200) is deployed and verified.
-- >>> Applying it earlier makes the feed, network pages and dashboard show only
-- >>> the viewer's own requirements.
--
-- Purpose: make the privacy_level masking enforceable. While the base table
-- lets every logged-in broker SELECT any active row, a broker can bypass the
-- view and read funding_status / purchase_purpose / preferred_localities of a
-- Highly Confidential requirement straight from public.requirements.
--
-- After this migration:
--   * public.requirements  -> SELECT returns only the caller's own rows
--                             (needed for the edit form, profile page, and
--                             write paths). INSERT/UPDATE/DELETE unchanged.
--   * public.requirements_feed -> the way to read other brokers' requirements,
--                             with confidential fields masked.
--
-- The migration refuses to run if the view is missing, so it cannot be applied
-- out of order. NON-DESTRUCTIVE: only a policy is swapped. Idempotent.
-- ============================================================================

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.requirements_feed') IS NULL THEN
    RAISE EXCEPTION
      'public.requirements_feed is missing: apply 20261103120200_create_requirements_feed_view.sql first'
      USING ERRCODE = '42P01';
  END IF;
END;
$$;

DROP POLICY IF EXISTS requirements_select_authenticated ON public.requirements;
DROP POLICY IF EXISTS requirements_select_own ON public.requirements;

CREATE POLICY requirements_select_own
  ON public.requirements FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid());
