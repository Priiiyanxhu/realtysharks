-- ============================================================================
-- 20261103120200_create_requirements_feed_view.sql   (rollout phase 1 of 2)
--
-- Purpose: give privacy_level real meaning without hiding requirements from
-- the brokers they are posted to reach.
--
--   privacy_level = 'Standard' (or NULL, legacy rows)
--       -> every logged-in broker sees the whole requirement, as today.
--   privacy_level = anything else ('Highly Confidential' from the app; any
--   unknown value is treated the same way, so a typo fails closed)
--       -> other brokers still see the requirement (city, type, configuration,
--          budget, timeline, ...) so matching works, but these client-
--          identifying fields are returned as NULL:
--              funding_status, purchase_purpose, preferred_localities
--       -> the posting broker always sees everything on their own rows.
--
-- RLS cannot hide individual columns of a row that is otherwise readable, so
-- masking is done by this view. Other users' requirements must be read through
-- it; phase 2 (20261103120300) then stops the base table from serving other
-- users' rows at all, which is what makes the masking enforceable.
--
-- ABOUT SECURITY DEFINER: the view deliberately runs with its owner's
-- privileges (it is NOT security_invoker). It has to read rows that the base
-- table's owner-only policy (phase 2) hides from the caller. This is safe
-- because every row filter and mask below is computed from auth.uid(), a
-- per-request setting that does not depend on the executing role, and because
-- anon has no access. Supabase's linter will flag "security definer view";
-- that is expected and intentional here. security_barrier = true stops
-- user-supplied filters/functions from being evaluated against rows or
-- unmasked values before the view's own WHERE/CASE are applied.
--
-- ADDITIVE and safe to apply BEFORE the frontend is updated: it changes no
-- existing table, policy or grant. Idempotent / rerun-safe.
--
-- If requirements gains new client-identifying columns later, add them to the
-- CASE list below (CREATE OR REPLACE VIEW can append columns at the end only).
-- ============================================================================

CREATE OR REPLACE VIEW public.requirements_feed
WITH (security_barrier = true) AS
SELECT
  r.id,
  r.broker_id,
  r.property_type,
  r.city,
  CASE WHEN m.masked THEN NULL ELSE r.preferred_localities END
    AS preferred_localities,
  r.configuration,
  r.budget_min_inr,
  r.budget_max_inr,
  r.min_square_feet,
  r.details,
  r.privacy_level,
  r.required_amenities,
  r.client_profile,
  CASE WHEN m.masked THEN NULL ELSE r.funding_status END
    AS funding_status,
  r.timeline_to_close,
  CASE WHEN m.masked THEN NULL ELSE r.purchase_purpose END
    AS purchase_purpose,
  r.expected_yield,
  r.direct_mandate_only,
  r.is_active,
  r.created_at,
  r.updated_at
FROM public.requirements AS r
CROSS JOIN LATERAL (
  SELECT (
    r.broker_id IS DISTINCT FROM auth.uid()
    AND COALESCE(r.privacy_level, 'Standard') <> 'Standard'
  ) AS masked
) AS m
WHERE r.is_active = true
   OR r.broker_id = auth.uid();

-- Read-only, logged-in users only. Replace the default grants Supabase gives
-- every new object in public.
REVOKE ALL ON TABLE public.requirements_feed FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.requirements_feed TO authenticated;
