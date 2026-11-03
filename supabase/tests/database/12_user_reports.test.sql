BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(29);

-- The daily cap is pinned at 10 new reports per rolling 24h per reporter.

-- ---------------------------------------------------------------------------
-- Structure and access: nobody can read or write reports through the API
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.user_reports'::pg_catalog.regclass),
  'RLS is enabled on user_reports'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_reports'
  ),
  'user_reports has no policies (default deny)'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(role_name || ':' || privilege_name, ',' ORDER BY role_name, privilege_name)
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name),
         (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege(role_name, 'public.user_reports', privilege_name)
  ),
  NULL::text,
  'neither anon nor authenticated has any privilege on user_reports'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege('authenticated', 'public.report_user(uuid,text,text,uuid)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.report_user(uuid,text,text,uuid)', 'EXECUTE'),
  'report_user is executable by authenticated and not by anon'
);

-- ---------------------------------------------------------------------------
-- Fixtures. R reports; D is reported; O and T are other people.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'report-' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'Report ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM pg_catalog.generate_series(601, 604) AS n;
-- 601 = R, 602 = D, 603 = O, 604 = T

INSERT INTO public.conversations (id, created_by) VALUES
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000601'),  -- R <-> D
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000601'),  -- R <-> T
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000602');  -- D <-> T
INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000601'),
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000602'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000601'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000604'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000602'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000604');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'spam')$$,
  '28000', 'authentication required',
  'reporting without a session is rejected'
);

-- ---------------------------------------------------------------------------
-- R files reports
-- ---------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000601';

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'spam', '  sends unsolicited offers  ') ->> 'status',
  'created',
  'a valid report is created'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT reporter_id::text || '/' || reported_id::text || '/' || reason || '/' || status || '/' || details
     FROM public.user_reports),
  '00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-000000000602/spam/open/sends unsolicited offers',
  'the stored report has the right people, reason, open status and trimmed details'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000601';

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'spam', 'again') ->> 'status',
  'duplicate',
  'the same reason against the same person while open is a duplicate'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.user_reports),
  1,
  'a duplicate wrote nothing'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000601';

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'harassment') ->> 'status',
  'created',
  'a different reason against the same person is a new report'
);

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'fake_profile', NULL,
                     '00000000-0000-4000-8000-000000000701') ->> 'status',
  'created',
  'a report may attach the conversation the reporter shares with the reported person'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'scam_or_fraud', NULL,
                              '00000000-0000-4000-8000-000000000702')$$,
  '42501', 'invalid conversation',
  'a conversation that does not include the reported person is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'scam_or_fraud', NULL,
                              '00000000-0000-4000-8000-000000000703')$$,
  '42501', 'invalid conversation',
  'a conversation the reporter is not part of is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000601', 'spam')$$,
  '22023', 'cannot report yourself',
  'reporting yourself is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'because')$$,
  '22023', 'invalid report reason',
  'an unknown reason is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'other', '   ')$$,
  '22023', 'details are required when the reason is other',
  'the reason "other" needs details'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('00000000-0000-4000-8000-000000000602', 'spam', repeat('x', 1001))$$,
  '22023', 'report details are too long',
  'details over 1000 characters are rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user('99999999-9999-4999-8999-999999999999', 'spam')$$,
  '23503', 'reported user does not exist',
  'reporting a user that does not exist is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.report_user(NULL, 'spam')$$,
  '22004', 'reported user is required',
  'a missing reported user is rejected'
);

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'inappropriate_content', '   ') ->> 'status',
  'created',
  'blank details are accepted for a reason that does not require them'
);

SELECT extensions.throws_ok(
  $$SELECT count(*) FROM public.user_reports$$,
  '42501', NULL,
  'the reporter cannot read reports through the API'
);

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000602';

SELECT extensions.throws_ok(
  $$SELECT count(*) FROM public.user_reports$$,
  '42501', NULL,
  'the reported person cannot read reports about them'
);

RESET ROLE;

SELECT extensions.ok(
  (SELECT details IS NULL FROM public.user_reports WHERE reason = 'inappropriate_content'),
  'blank details were stored as NULL'
);

-- ---------------------------------------------------------------------------
-- Daily cap: 10 new reports per rolling 24h
-- R has filed 4 so far (spam, harassment, fake_profile, inappropriate_content).
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000601';

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int
     FROM (VALUES
       ('00000000-0000-4000-8000-000000000604'::uuid, 'spam'),
       ('00000000-0000-4000-8000-000000000604'::uuid, 'harassment'),
       ('00000000-0000-4000-8000-000000000604'::uuid, 'scam_or_fraud'),
       ('00000000-0000-4000-8000-000000000604'::uuid, 'fake_profile'),
       ('00000000-0000-4000-8000-000000000603'::uuid, 'spam'),
       ('00000000-0000-4000-8000-000000000603'::uuid, 'harassment')
     ) AS v(target, why)
    WHERE public.report_user(v.target, v.why) ->> 'status' = 'created'),
  6,
  'six more reports bring the reporter to exactly 10 in 24 hours'
);

SELECT extensions.ok(
  (SELECT d ->> 'status' = 'rate_limited'
      AND (d ->> 'retry_after_seconds')::int BETWEEN 1 AND 86400
     FROM (SELECT public.report_user('00000000-0000-4000-8000-000000000603', 'scam_or_fraud') AS d) AS x),
  'the 11th report in 24 hours is rate limited, with a retry time'
);

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'spam') ->> 'status',
  'duplicate',
  'at the cap, an already-open report is still reported as a duplicate, not rate limited'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.user_reports
    WHERE reporter_id = '00000000-0000-4000-8000-000000000601'),
  10,
  'a rate-limited call wrote nothing'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000604';

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'spam') ->> 'status',
  'created',
  'another reporter is unaffected by the first reporter''s cap'
);

RESET ROLE;

-- Reports age out of the window; old open reports no longer block a repeat.
UPDATE public.user_reports
   SET created_at = pg_catalog.clock_timestamp() - interval '25 hours',
       status = 'dismissed'
 WHERE reporter_id = '00000000-0000-4000-8000-000000000601';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000601';

SELECT extensions.is(
  public.report_user('00000000-0000-4000-8000-000000000602', 'spam') ->> 'status',
  'created',
  'once reports are older than 24h and dismissed, the reporter can report again'
);

RESET ROLE;

SELECT * FROM extensions.finish();

ROLLBACK;
