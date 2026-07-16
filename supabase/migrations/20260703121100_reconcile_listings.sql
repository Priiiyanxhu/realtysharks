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
-- Depends on 20260703121000_reconcile_profiles.sql (adds UNIQUE(auth_id) before
-- this migration establishes listings.broker_id -> profiles(auth_id)).
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
-- Each legacy source column (location, bhk, price, image_url, status) may not
-- exist in the live DB, so every backfill that references one is guarded with
-- an information_schema existence check + dynamic EXECUTE.

-- city <- location
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'location'
  ) THEN
    EXECUTE '
      UPDATE public.listings
         SET city = location
       WHERE city IS NULL
         AND location IS NOT NULL
    ';
  END IF;
END $$;

-- configuration <- bhk
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'bhk'
  ) THEN
    EXECUTE '
      UPDATE public.listings
         SET configuration = bhk
       WHERE configuration IS NULL
         AND bhk IS NOT NULL
    ';
  END IF;
END $$;

-- price_inr <- price
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'price'
  ) THEN
    EXECUTE '
      UPDATE public.listings
         SET price_inr = price
       WHERE price_inr IS NULL
         AND price IS NOT NULL
    ';
  END IF;
END $$;

-- images[] <- single image_url (wrap into a one-element array)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'image_url'
  ) THEN
    EXECUTE '
      UPDATE public.listings
         SET images = ARRAY[image_url]
       WHERE images IS NULL
         AND image_url IS NOT NULL
    ';
  END IF;
END $$;

-- Ensure images is never NULL (app expects an array; empty default).
UPDATE public.listings
   SET images = '{}'
 WHERE images IS NULL;

-- is_active <- (legacy status = 'active')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'status'
  ) THEN
    EXECUTE '
      UPDATE public.listings
         SET is_active = (status = ''active'')
       WHERE is_active IS NULL
         AND status IS NOT NULL
    ';
  END IF;
END $$;

UPDATE public.listings
   SET is_active = true
 WHERE is_active IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Reconcile legacy nullability for canonical-only listing writes
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  legacy_column text;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY['price', 'location', 'bhk']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = 'public.listings'::pg_catalog.regclass
        AND attribute.attname = legacy_column
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ) THEN
      EXECUTE pg_catalog.format(
        'ALTER TABLE public.listings ALTER COLUMN %I DROP NOT NULL',
        legacy_column
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Establish the canonical broker ownership foreign key by semantic shape
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  canonical_constraint_oid oid;
  equivalent_constraint_name text;
BEGIN
  SELECT constraint_row.oid
    INTO canonical_constraint_oid
    FROM pg_catalog.pg_constraint AS constraint_row
   WHERE constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
     AND constraint_row.conname = 'listings_broker_id_fkey';

  IF canonical_constraint_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_attribute AS source_attribute
        ON source_attribute.attrelid = constraint_row.conrelid
       AND source_attribute.attnum = constraint_row.conkey[1]
       AND NOT source_attribute.attisdropped
      JOIN pg_catalog.pg_attribute AS target_attribute
        ON target_attribute.attrelid = constraint_row.confrelid
       AND target_attribute.attnum = constraint_row.confkey[1]
       AND NOT target_attribute.attisdropped
      WHERE constraint_row.oid = canonical_constraint_oid
        AND constraint_row.contype = 'f'
        AND constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
        AND constraint_row.confrelid = 'public.profiles'::pg_catalog.regclass
        AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
        AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
        AND source_attribute.attname = 'broker_id'
        AND target_attribute.attname = 'auth_id'
        AND constraint_row.confdeltype = 'c'
    ) THEN
      RAISE EXCEPTION
        'Constraint listings_broker_id_fkey exists but does not match listings(broker_id) -> profiles(auth_id) ON DELETE CASCADE';
    END IF;
  ELSE
    SELECT constraint_row.conname
      INTO equivalent_constraint_name
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_attribute AS source_attribute
        ON source_attribute.attrelid = constraint_row.conrelid
       AND source_attribute.attnum = constraint_row.conkey[1]
       AND NOT source_attribute.attisdropped
      JOIN pg_catalog.pg_attribute AS target_attribute
        ON target_attribute.attrelid = constraint_row.confrelid
       AND target_attribute.attnum = constraint_row.confkey[1]
       AND NOT target_attribute.attisdropped
     WHERE constraint_row.contype = 'f'
       AND constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
       AND constraint_row.confrelid = 'public.profiles'::pg_catalog.regclass
       AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
       AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
       AND source_attribute.attname = 'broker_id'
       AND target_attribute.attname = 'auth_id'
       AND constraint_row.confdeltype = 'c'
     ORDER BY constraint_row.oid
     LIMIT 1;

    IF equivalent_constraint_name IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'ALTER TABLE public.listings RENAME CONSTRAINT %I TO listings_broker_id_fkey',
        equivalent_constraint_name
      );
    ELSE
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_broker_id_fkey
        FOREIGN KEY (broker_id)
        REFERENCES public.profiles(auth_id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Restore authenticated table privileges so the owner-scoped RLS policies
--    can authorize canonical application reads and writes on a fresh replay.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.listings
  TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Indexes for the app's common filters
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS listings_broker_id_idx ON public.listings (broker_id);
CREATE INDEX IF NOT EXISTS listings_is_active_idx ON public.listings (is_active);
CREATE INDEX IF NOT EXISTS listings_city_idx      ON public.listings (city);
