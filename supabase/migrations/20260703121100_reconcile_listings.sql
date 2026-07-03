-- ============================================================================
-- 20260703121100_reconcile_listings.sql
--
-- Purpose: add the listings columns the app actually reads/writes. The
-- post-listing form, listings browse/detail, dashboard, profile and pdf export
-- all use city / locality / configuration / price_inr / square_feet /
-- description / images[] / is_active, none of which the original
-- 20260616194000_create_listings.sql created (it created
-- location / bhk / price / status / image_url instead).
--
-- NON-DESTRUCTIVE:
--   * ADD COLUMN IF NOT EXISTS only. No column dropped or renamed.
--   * Legacy columns (location, bhk, price, status, image_url) are KEPT.
--   * Backfills only touch rows where the new column IS NULL (idempotent).
--
-- Depends on 20260703121000_reconcile_profiles.sql (adds UNIQUE(auth_id) that
-- the pre-existing listings.broker_id -> profiles(auth_id) FK relies on).
-- The FK itself is NOT modified here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the columns the app expects (keep all legacy columns intact)
-- ----------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS locality      text,
  ADD COLUMN IF NOT EXISTS configuration text,
  ADD COLUMN IF NOT EXISTS price_inr     numeric,
  ADD COLUMN IF NOT EXISTS square_feet   numeric,
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS images        text[],
  ADD COLUMN IF NOT EXISTS is_active     boolean DEFAULT true;

-- ----------------------------------------------------------------------------
-- 2. Safe backfills from legacy columns (only where new column is NULL)
-- ----------------------------------------------------------------------------
-- city <- location
UPDATE public.listings
   SET city = location
 WHERE city IS NULL
   AND location IS NOT NULL;

-- configuration <- bhk
UPDATE public.listings
   SET configuration = bhk
 WHERE configuration IS NULL
   AND bhk IS NOT NULL;

-- price_inr <- price
UPDATE public.listings
   SET price_inr = price
 WHERE price_inr IS NULL
   AND price IS NOT NULL;

-- images[] <- single image_url (wrap into a one-element array)
UPDATE public.listings
   SET images = ARRAY[image_url]
 WHERE images IS NULL
   AND image_url IS NOT NULL;

-- Ensure images is never NULL (app expects an array; empty default).
UPDATE public.listings
   SET images = '{}'
 WHERE images IS NULL;

-- is_active <- (legacy status = 'active')
UPDATE public.listings
   SET is_active = (status = 'active')
 WHERE is_active IS NULL
   AND status IS NOT NULL;

UPDATE public.listings
   SET is_active = true
 WHERE is_active IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Indexes for the app's common filters
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS listings_broker_id_idx ON public.listings (broker_id);
CREATE INDEX IF NOT EXISTS listings_is_active_idx ON public.listings (is_active);
CREATE INDEX IF NOT EXISTS listings_city_idx      ON public.listings (city);
