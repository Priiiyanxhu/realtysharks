BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(23);

-- ---------------------------------------------------------------------------
-- Structure and grants
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = pg_catalog.to_regclass('public.requirements_feed')
      AND relkind = 'v'
      AND COALESCE(reloptions, ARRAY[]::text[]) @> ARRAY['security_barrier=true']
  ),
  'requirements_feed is a security_barrier view'
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
      'anon', 'public.requirements_feed', privilege_name
    )
  ),
  NULL::text,
  'anon has no requirements_feed privileges'
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
      'authenticated', 'public.requirements_feed', privilege_name
    )
  ),
  'SELECT',
  'authenticated has SELECT only on requirements_feed'
);

-- ---------------------------------------------------------------------------
-- Fixtures: Bob (poster) and Alice (another broker)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000531', 'authenticated', 'authenticated',
   'priv-alice-531@example.invalid', '{}'::jsonb,
   '{"full_name":"Priv Alice"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000532', 'authenticated', 'authenticated',
   'priv-bob-532@example.invalid', '{}'::jsonb,
   '{"full_name":"Priv Bob"}'::jsonb, pg_catalog.now(), pg_catalog.now());

INSERT INTO public.requirements
  (id, broker_id, property_type, city, preferred_localities, budget_max_inr,
   funding_status, purchase_purpose, client_profile, details, is_active, privacy_level)
VALUES
  -- Bob: confidential, active
  ('00000000-0000-4000-8000-000000000541',
   '00000000-0000-4000-8000-000000000532', 'Apartment', 'Mumbai',
   ARRAY['Bandra', 'Worli'], 90000000,
   'cash ready', 'investment', 'VIP client', 'Detail VIP client', true, 'Highly Confidential'),
  -- Bob: standard, active
  ('00000000-0000-4000-8000-000000000542',
   '00000000-0000-4000-8000-000000000532', 'Villa', 'Pune',
   ARRAY['Baner'], 40000000,
   'loan approved', 'self use', 'Family', 'Detail Family', true, 'Standard'),
  -- Bob: legacy NULL privacy_level, active
  ('00000000-0000-4000-8000-000000000543',
   '00000000-0000-4000-8000-000000000532', 'Office', 'Delhi',
   ARRAY['Gurgaon'], 20000000,
   'self funded', 'expansion', 'Startup', 'Detail Startup', true, NULL),
  -- Bob: unknown value, active -> fails closed (masked)
  ('00000000-0000-4000-8000-000000000544',
   '00000000-0000-4000-8000-000000000532', 'Plot', 'Goa',
   ARRAY['Assagao'], 15000000,
   'cash ready', 'holiday home', 'NRI', 'Detail NRI', true, 'Top Secret'),
  -- Bob: confidential but inactive
  ('00000000-0000-4000-8000-000000000545',
   '00000000-0000-4000-8000-000000000532', 'Apartment', 'Chennai',
   ARRAY['Adyar'], 30000000,
   'cash ready', 'investment', 'Hidden', 'Detail Hidden', false, 'Highly Confidential'),
  -- Alice: confidential, active (her own)
  ('00000000-0000-4000-8000-000000000546',
   '00000000-0000-4000-8000-000000000531', 'Apartment', 'Bengaluru',
   ARRAY['Indiranagar'], 50000000,
   'cash ready', 'investment', 'Alice VIP', 'Detail Alice VIP', true, 'Highly Confidential');

-- ---------------------------------------------------------------------------
-- Anonymous: nothing
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$SELECT * FROM public.requirements_feed$$,
  '42501', NULL,
  'anon cannot read requirements_feed'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Alice reading Bob's requirements through the feed
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000531';

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(id::text, ',' ORDER BY id)
     FROM public.requirements_feed
    WHERE broker_id = '00000000-0000-4000-8000-000000000532'),
  '00000000-0000-4000-8000-000000000541,00000000-0000-4000-8000-000000000542,00000000-0000-4000-8000-000000000543,00000000-0000-4000-8000-000000000544',
  'Alice sees Bob''s active requirements (including confidential ones) but not his inactive one'
);

SELECT extensions.is(
  (SELECT funding_status || '/' || purchase_purpose || '/' ||
          pg_catalog.array_to_string(preferred_localities, ',') || '/' ||
          client_profile || '/' || details
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000542'),
  'loan approved/self use/Baner/Family/Detail Family',
  'Standard requirement is fully visible'
);

SELECT extensions.is(
  (SELECT funding_status || '/' || purchase_purpose || '/' ||
          pg_catalog.array_to_string(preferred_localities, ',') || '/' ||
          client_profile || '/' || details
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000543'),
  'self funded/expansion/Gurgaon/Startup/Detail Startup',
  'legacy NULL privacy_level is treated as Standard'
);

SELECT extensions.ok(
  (SELECT funding_status IS NULL
      AND purchase_purpose IS NULL
      AND preferred_localities IS NULL
      AND client_profile IS NULL
      AND details IS NULL
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000541'),
  'Highly Confidential: funding_status, purchase_purpose, preferred_localities, client_profile and details are masked'
);

SELECT extensions.is(
  (SELECT city || '/' || property_type || '/' || budget_max_inr::text || '/' ||
          privacy_level
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000541'),
  'Mumbai/Apartment/90000000/Highly Confidential',
  'Highly Confidential: matching fields (city, type, budget, privacy_level) stay visible'
);

SELECT extensions.ok(
  (SELECT funding_status IS NULL
      AND purchase_purpose IS NULL
      AND preferred_localities IS NULL
      AND client_profile IS NULL
      AND details IS NULL
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000544'),
  'an unknown privacy_level value fails closed (masked)'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM public.requirements_feed
    WHERE funding_status = 'cash ready'
      AND broker_id = '00000000-0000-4000-8000-000000000532'),
  0,
  'filtering on a masked column cannot reveal confidential values'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM public.requirements_feed
    WHERE 'Bandra' = ANY (preferred_localities)),
  0,
  'filtering on masked localities cannot reveal confidential values'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM public.requirements_feed
    WHERE client_profile = 'VIP client'),
  0,
  'filtering on masked client_profile cannot reveal confidential values'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM public.requirements_feed
    WHERE details ILIKE '%VIP%'
      AND broker_id = '00000000-0000-4000-8000-000000000532'),
  0,
  'keyword search on masked details cannot reveal confidential values'
);

SELECT extensions.is(
  (SELECT funding_status || '/' || purchase_purpose || '/' ||
          pg_catalog.array_to_string(preferred_localities, ',') || '/' ||
          client_profile || '/' || details
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000546'),
  'cash ready/investment/Indiranagar/Alice VIP/Detail Alice VIP',
  'a poster sees their own confidential requirement unmasked'
);

-- Base table: only own rows, so the view cannot be bypassed.
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.requirements
    WHERE broker_id = '00000000-0000-4000-8000-000000000532'),
  0,
  'the base table serves none of Bob''s rows to Alice'
);

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(id::text, ',')
     FROM public.requirements),
  '00000000-0000-4000-8000-000000000546',
  'the base table serves Alice only her own requirement'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.requirements_feed (broker_id, city)
    VALUES ('00000000-0000-4000-8000-000000000531', 'X')$$,
  '55000', NULL,
  'requirements_feed rejects writes (it is not an updatable view)'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Bob reading his own rows
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000532';

SELECT extensions.is(
  (SELECT funding_status || '/' || purchase_purpose || '/' ||
          pg_catalog.array_to_string(preferred_localities, ',') || '/' ||
          client_profile || '/' || details
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000541'),
  'cash ready/investment/Bandra,Worli/VIP client/Detail VIP client',
  'Bob sees his own confidential requirement unmasked (all five fields)'
);

SELECT extensions.is(
  (SELECT funding_status
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000545'),
  'cash ready',
  'Bob sees his own inactive confidential requirement unmasked'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM public.requirements_feed
    WHERE broker_id = '00000000-0000-4000-8000-000000000531'),
  1,
  'Bob sees Alice''s active confidential requirement through the feed'
);

SELECT extensions.ok(
  (SELECT funding_status IS NULL
     FROM public.requirements_feed
    WHERE id = '00000000-0000-4000-8000-000000000546'),
  'and it is masked for him'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- The phase-2 guard: policy is owner-only
-- ---------------------------------------------------------------------------
SELECT extensions.is(
  (SELECT qual FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'requirements'
      AND policyname = 'requirements_select_own'),
  '(broker_id = auth.uid())',
  'requirements SELECT policy is owner-only'
);

SELECT * FROM extensions.finish();

ROLLBACK;
