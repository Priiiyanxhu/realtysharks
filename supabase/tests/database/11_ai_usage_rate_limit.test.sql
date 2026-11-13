BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(21);

-- The limits below are pinned on purpose (5/minute, 50/day per user, 2000/day
-- global). If you tune the constants in consume_ai_quota(), change them here.

-- ---------------------------------------------------------------------------
-- Structure and access: clients can only reach the table through the function
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.ai_usage_events'::pg_catalog.regclass),
  'RLS is enabled on ai_usage_events'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_usage_events'
  ),
  'ai_usage_events has no policies (default deny)'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(role_name || ':' || privilege_name, ',' ORDER BY role_name, privilege_name)
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name),
         (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(role_name, 'public.ai_usage_events', privilege_name)
  ),
  NULL::text,
  'neither anon nor authenticated has any privilege on ai_usage_events'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege('authenticated', 'public.consume_ai_quota()', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.consume_ai_quota()', 'EXECUTE'),
  'consume_ai_quota is executable by authenticated and not by anon'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'ai-quota-' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'AI Quota ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM pg_catalog.generate_series(591, 594) AS n;
-- 591 = A (the heavy user), 592 = B (bystander), 593 = C (fresh), 594 = F (filler)

-- No session at all
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT extensions.throws_ok(
  $$SELECT public.consume_ai_quota()$$,
  '28000', 'authentication required',
  'calling without a session is rejected'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Per-minute limit: 5 allowed, the 6th denied
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM pg_catalog.generate_series(1, 5) AS g
    WHERE (public.consume_ai_quota() ->> 'allowed')::boolean),
  5,
  'a user gets 5 uses in a minute'
);

SELECT extensions.is(
  (public.consume_ai_quota() ->> 'allowed')::boolean,
  false,
  'the 6th use inside a minute is denied'
);

SELECT extensions.ok(
  (SELECT d ->> 'limit_scope' = 'minute'
      AND (d ->> 'retry_after_seconds')::int BETWEEN 1 AND 60
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'the denial names the minute scope and a retry time of 1-60 seconds'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.ai_usage_events
    WHERE user_id = '00000000-0000-4000-8000-000000000591'),
  5,
  'denied calls recorded nothing (the table holds exactly the 5 allowed uses)'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000592';

SELECT extensions.is(
  (public.consume_ai_quota() ->> 'allowed')::boolean,
  true,
  'another user is unaffected by the first user''s limit'
);

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';
SELECT public.consume_ai_quota();
SELECT public.consume_ai_quota();
SELECT public.consume_ai_quota();

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.ai_usage_events
    WHERE user_id = '00000000-0000-4000-8000-000000000591'),
  5,
  'hammering while blocked never grows the table or extends the lockout'
);

-- ---------------------------------------------------------------------------
-- The window is rolling, and the reported wait is accurate
-- ---------------------------------------------------------------------------
UPDATE public.ai_usage_events
   SET created_at = pg_catalog.clock_timestamp() - interval '50 seconds'
 WHERE user_id = '00000000-0000-4000-8000-000000000591';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';

SELECT extensions.ok(
  (SELECT (d ->> 'allowed')::boolean = false
      AND (d ->> 'retry_after_seconds')::int BETWEEN 9 AND 11
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'with the oldest use 50s old, the user is told to wait about 10s'
);

RESET ROLE;

UPDATE public.ai_usage_events
   SET created_at = pg_catalog.clock_timestamp() - interval '2 minutes'
 WHERE user_id = '00000000-0000-4000-8000-000000000591';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';

SELECT extensions.is(
  (public.consume_ai_quota() ->> 'allowed')::boolean,
  true,
  'once the uses are older than a minute the user may generate again'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Per-day limit: 50
-- ---------------------------------------------------------------------------
DELETE FROM public.ai_usage_events
 WHERE user_id = '00000000-0000-4000-8000-000000000591';

-- 49 uses spread over the past ~23 hours, none inside the last minute
INSERT INTO public.ai_usage_events (user_id, created_at)
SELECT '00000000-0000-4000-8000-000000000591',
       pg_catalog.clock_timestamp() - interval '23 hours' + (g * interval '1 minute')
  FROM pg_catalog.generate_series(1, 49) AS g;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';

SELECT extensions.is(
  (public.consume_ai_quota() ->> 'allowed')::boolean,
  true,
  'the 50th use in 24 hours is allowed'
);

SELECT extensions.is(
  (SELECT d ->> 'limit_scope'
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'day',
  'the 51st use in 24 hours is denied with the day scope'
);

SELECT extensions.ok(
  (SELECT (d ->> 'retry_after_seconds')::int BETWEEN 3500 AND 3660
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'the day denial reports when the oldest use leaves the window (about 1 hour)'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Global circuit breaker: 2000 per 24h across ALL users
-- ---------------------------------------------------------------------------
DELETE FROM public.ai_usage_events;

INSERT INTO public.ai_usage_events (user_id, created_at)
SELECT '00000000-0000-4000-8000-000000000594',
       pg_catalog.clock_timestamp() - interval '1 hour' + (g * interval '1 second')
  FROM pg_catalog.generate_series(1, 2000) AS g;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000593';

SELECT extensions.is(
  (SELECT d ->> 'limit_scope'
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'global',
  'a brand-new user is denied once 2000 uses exist in 24 hours (global scope)'
);

SELECT extensions.ok(
  (SELECT (d ->> 'retry_after_seconds')::int BETWEEN 82700 AND 82810
     FROM (SELECT public.consume_ai_quota() AS d) AS x),
  'the global denial reports when the oldest use leaves the window (about 23 hours)'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.ai_usage_events
    WHERE user_id = '00000000-0000-4000-8000-000000000593'),
  0,
  'a globally denied call recorded nothing for the caller'
);

-- ---------------------------------------------------------------------------
-- Housekeeping: expired rows are removed, recent rows are kept
-- ---------------------------------------------------------------------------
DELETE FROM public.ai_usage_events;

INSERT INTO public.ai_usage_events (user_id, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000591', pg_catalog.clock_timestamp() - interval '26 hours'),
  ('00000000-0000-4000-8000-000000000591', pg_catalog.clock_timestamp() - interval '27 hours'),
  ('00000000-0000-4000-8000-000000000591', pg_catalog.clock_timestamp() - interval '28 hours'),
  ('00000000-0000-4000-8000-000000000594', pg_catalog.clock_timestamp() - interval '30 hours'),
  ('00000000-0000-4000-8000-000000000594', pg_catalog.clock_timestamp() - interval '31 hours'),
  ('00000000-0000-4000-8000-000000000592', pg_catalog.clock_timestamp() - interval '2 hours');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000591';
SELECT public.consume_ai_quota();
RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.ai_usage_events
    WHERE created_at <= pg_catalog.clock_timestamp() - interval '24 hours'),
  0,
  'a call clears expired rows, including other users'' expired rows'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.ai_usage_events
    WHERE user_id = '00000000-0000-4000-8000-000000000592'),
  1,
  'unexpired rows of other users are kept'
);

SELECT * FROM extensions.finish();

ROLLBACK;
