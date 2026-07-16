BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(48);

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

SELECT extensions.ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'listings'
    AND column_name = 'privacy_level'
), 'listings.privacy_level exists');

SELECT extensions.is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings'
      AND column_name = 'privacy_level'
  ),
  '''public''::text',
  'listings.privacy_level defaults to public for application-created rows'
);

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
      AND target_attribute.attname = 'id'
      AND constraint_row.confdeltype = 'c'
  ),
  'listings broker FK has the canonical semantic shape and cascade action'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(
      policyname || ':' || cmd,
      ',' ORDER BY policyname
    )
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'listings'
  ),
  'listings_delete_own:DELETE,listings_insert_own:INSERT,listings_select_authenticated:SELECT,listings_update_own:UPDATE',
  'listings has exactly the four canonical command policies'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.bool_and(roles = ARRAY['authenticated']::name[])
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'listings'
  ),
  'all listings policies apply only to authenticated users'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Listings are viewable by everyone.'
  ),
  'the unrestricted public listings policy is absent'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (
      VALUES
        ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
        ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
    ) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(
      'anon', 'public.listings', privilege_name
    )
  ),
  NULL::text,
  'anon has no listings table privileges'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (
      VALUES
        ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
        ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
    ) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(
      'authenticated', 'public.listings', privilege_name
    )
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated has only required listings table privileges'
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

INSERT INTO public.listings (
  id, broker_id, title, property_type, is_active, privacy_level
)
VALUES
  (
    '00000000-0000-4000-8000-000000000311',
    '00000000-0000-4000-8000-000000000201',
    'Active Public Visibility Listing', 'Apartment', true, 'public'
  ),
  (
    '00000000-0000-4000-8000-000000000312',
    '00000000-0000-4000-8000-000000000201',
    'Active Private Visibility Listing', 'Apartment', true, 'private'
  ),
  (
    '00000000-0000-4000-8000-000000000313',
    '00000000-0000-4000-8000-000000000201',
    'Inactive Public Visibility Listing', 'Apartment', false, 'public'
  ),
  (
    '00000000-0000-4000-8000-000000000314',
    '00000000-0000-4000-8000-000000000201',
    'Inactive Private Visibility Listing', 'Apartment', false, 'private'
  ),
  (
    '00000000-0000-4000-8000-000000000315',
    '00000000-0000-4000-8000-000000000201',
    'Active Legacy Null Visibility Listing', 'Apartment', true, NULL
  );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000201';

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000311'
), 1::bigint, 'owner can select their active public listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000312'
), 1::bigint, 'owner can select their active private listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000313'
), 1::bigint, 'owner can select their inactive public listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000314'
), 1::bigint, 'owner can select their inactive private listing');

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000202';

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000311'
), 1::bigint, 'another authenticated user can select an active public listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000315'
), 1::bigint, 'another authenticated user can select an active legacy null-privacy listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000312'
), 0::bigint, 'another authenticated user cannot select an active private listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000313'
), 0::bigint, 'another authenticated user cannot select an inactive public listing');

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000314'
), 0::bigint, 'another authenticated user cannot select an inactive private listing');

RESET ROLE;

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

CREATE POLICY "test unexpected permissive listings policy"
  ON public.listings FOR SELECT
  TO authenticated
  USING (true);

SELECT public.normalize_listings_policies();

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'test unexpected permissive listings policy'
  ),
  'convergence rerun removes an arbitrarily named permissive listings policy'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(
      policyname || ':' || cmd,
      ',' ORDER BY policyname
    )
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'listings'
  ),
  'listings_delete_own:DELETE,listings_insert_own:INSERT,listings_select_authenticated:SELECT,listings_update_own:UPDATE',
  'convergence rerun leaves exactly the four canonical listings policies'
);

DELETE FROM auth.users
WHERE id = '00000000-0000-4000-8000-000000000201';

SELECT extensions.is((
  SELECT pg_catalog.count(*) FROM public.listings
  WHERE id = '00000000-0000-4000-8000-000000000301'
), 0::bigint, 'deleting the owner profile cascades to the listing');

SELECT * FROM extensions.finish();

ROLLBACK;
