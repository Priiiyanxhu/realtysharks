-- ============================================================================
-- 20261103120400_mask_client_profile_and_details.sql
--
-- Extends the privacy_level masking from 20261103120200 to two more
-- client-identifying free-text fields. For a requirement whose privacy_level is
-- not 'Standard'/NULL, viewers OTHER than the poster now also get NULL for:
--     client_profile   (who the client is)
--     details          (the free-text description, which often names the deal)
-- in addition to funding_status, purchase_purpose and preferred_localities.
-- The poster still sees everything on their own rows.
--
-- Forward-only: 20261103120200 is left untouched so environments that already
-- applied it stay consistent. CREATE OR REPLACE VIEW is allowed here because
-- the view's column names, order and types are unchanged - only the
-- expressions for client_profile and details change (both are text; a CASE
-- with a NULL branch keeps the type).
--
-- Rollout: order-independent with 20261103120300. It only tightens what the
-- view returns, and the frontend already tolerates NULL for these fields.
-- Search note: the listings search runs ilike('details', ...) on the view, so
-- confidential requirements no longer match keyword searches on their details
-- (they still match on city / type / budget filters). That is the intended
-- consequence of hiding the text.
--
-- Idempotent / rerun-safe. NON-DESTRUCTIVE: no table, column or row changes.
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
  CASE WHEN m.masked THEN NULL ELSE r.details END
    AS details,
  r.privacy_level,
  r.required_amenities,
  CASE WHEN m.masked THEN NULL ELSE r.client_profile END
    AS client_profile,
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

-- CREATE OR REPLACE keeps existing grants, but restate them so the intended
-- end state is explicit and a fresh replay cannot drift.
REVOKE ALL ON TABLE public.requirements_feed FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.requirements_feed TO authenticated;
