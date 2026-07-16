BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(30);

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'city'
), 'listings.city exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'locality'
), 'listings.locality exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'configuration'
), 'listings.configuration exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'price_inr'
), 'listings.price_inr exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'square_feet'
), 'listings.square_feet exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'description'
), 'listings.description exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'images'
), 'listings.images exists');

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'is_active'
), 'listings.is_active exists');

SELECT extensions.ok((
  SELECT is_nullable = 'YES' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'price'
), 'legacy listings.price is nullable');

SELECT extensions.ok((
  SELECT is_nullable = 'YES' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'location'
), 'legacy listings.location is nullable');

SELECT extensions.ok((
  SELECT is_nullable = 'YES' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'bhk'
), 'legacy listings.bhk is nullable');

SELECT extensions.ok((
  SELECT is_nullable = 'NO' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'broker_id'
), 'listings.broker_id remains NOT NULL');

SELECT extensions.ok((
  SELECT is_nullable = 'NO' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'title'
), 'listings.title remains NOT NULL');

SELECT extensions.ok((
  SELECT is_nullable = 'NO' FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'property_type'
), 'listings.property_type remains NOT NULL');

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_attribute AS source_attribute
      ON source_attribute.attrelid = constraint_row.conrelid
     AND source_attribute.attnum = constraint_row.conkey[1]
    JOIN pg_catalog.pg_attribute AS target_attribute
      ON target_attribute.attrelid = constraint_row.confrelid
     AND target_attribute.attnum = constraint_row.confkey[1]
    WHERE constraint_row.conname = 'listings_broker_id_fkey'
      AND constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
      AND constraint_row.confrelid = 'public.profiles'::pg_catalog.regclass
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
      AND source_attribute.attname = 'broker_id'
      AND target_attribute.attname = 'auth_id'
      AND constraint_row.confdeltype = 'c'
  ),
  'listings broker FK has the canonical semantic shape and cascade action'
);

INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    'authenticated', 'authenticated',
    'listing-owner-201@example.invalid', '{}'::jsonb,
    '{"full_name":"Listing Test Owner"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'authenticated', 'authenticated',
    'listing-other-202@example.invalid', '{}'::jsonb,
    '{"full_name":"Listing Test Other"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO public.listings (
      id,
      broker_id,
      title,
      property_type,
      city,
      locality,
      configuration,
      price_inr,
      square_feet,
      description,
      images,
      is_active
    )
    VALUES (
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000201',
      'Canonical Replay Listing',
      'Apartment',
      'Replay City',
      'Replay Locality',
      '3 BHK',
      12500000,
      1450,
      'Canonical-only listing payload',
      ARRAY['https://example.invalid/listing.webp'],
      true
    )
  $sql$,
  'authenticated owner can insert a canonical-only listing payload'
);

RESET ROLE;

SELECT extensions.ok(
  (
    SELECT price IS NULL AND location IS NULL AND bhk IS NULL
    FROM public.listings
    WHERE id = '00000000-0000-4000-8000-000000000301'
  ),
  'canonical insert leaves nullable legacy columns null'
);

SELECT extensions.is((
  SELECT city FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 'Replay City', 'canonical city is stored');

SELECT extensions.is((
  SELECT locality FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 'Replay Locality', 'canonical locality is stored');

SELECT extensions.is((
  SELECT configuration FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), '3 BHK', 'canonical configuration is stored');

SELECT extensions.is((
  SELECT price_inr FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 12500000::numeric, 'canonical price_inr is stored');

SELECT extensions.is((
  SELECT square_feet FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 1450::numeric, 'canonical square_feet is stored');

SELECT extensions.is((
  SELECT description FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 'Canonical-only listing payload', 'canonical description is stored');

SELECT extensions.is((
  SELECT images FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), ARRAY['https://example.invalid/listing.webp']::text[], 'canonical images are stored');

SELECT extensions.is((
  SELECT is_active FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), true, 'canonical is_active is stored');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

SELECT extensions.lives_ok(
  $sql$
    UPDATE public.listings
       SET title = 'Unauthorized Update'
     WHERE id = '00000000-0000-4000-8000-000000000301'
  $sql$,
  'another user update is safely filtered by RLS'
);

RESET ROLE;

SELECT extensions.is((
  SELECT title FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 'Canonical Replay Listing', 'another user cannot change the listing');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

SELECT extensions.lives_ok(
  $sql$
    DELETE FROM public.listings
     WHERE id = '00000000-0000-4000-8000-000000000301'
  $sql$,
  'another user delete is safely filtered by RLS'
);

RESET ROLE;

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 1::bigint, 'another user cannot delete the listing');

DELETE FROM auth.users
WHERE id = '00000000-0000-4000-8000-000000000201';

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 0::bigint, 'deleting the owner profile cascades to the listing');

SELECT * FROM extensions.finish();

ROLLBACK;
