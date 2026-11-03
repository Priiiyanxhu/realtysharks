BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(20);

-- ---------------------------------------------------------------------------
-- Structure and access
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.conversation_clears'::pg_catalog.regclass),
  'RLS is enabled on conversation_clears'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname || ':' || cmd, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_clears'
  ),
  'conversation_clears_select_own:SELECT',
  'conversation_clears has exactly one policy: owner-only SELECT'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(privilege_name, ',' ORDER BY privilege_name)
    FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) AS privileges(privilege_name)
    WHERE pg_catalog.has_table_privilege('authenticated', 'public.conversation_clears', privilege_name)
  ),
  'SELECT',
  'authenticated may only SELECT from conversation_clears'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege('anon', 'public.conversation_clears', 'SELECT')
  AND pg_catalog.has_function_privilege('authenticated', 'public.clear_conversation_history(uuid)', 'EXECUTE')
  AND NOT pg_catalog.has_function_privilege('anon', 'public.clear_conversation_history(uuid)', 'EXECUTE'),
  'anon has no access; only authenticated can execute clear_conversation_history'
);

-- ---------------------------------------------------------------------------
-- Fixtures: A and B share a conversation with two messages; X is an outsider.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'clear-' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'Clear ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM pg_catalog.generate_series(611, 613) AS n;
-- 611 = A, 612 = B, 613 = X

INSERT INTO public.conversations (id, created_by)
VALUES ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000611');
INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000611'),
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000612');
INSERT INTO public.messages (conversation_id, sender_id, body) VALUES
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000611', 'hello from A'),
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000612', 'hello from B');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT extensions.throws_ok(
  $$SELECT public.clear_conversation_history('00000000-0000-4000-8000-000000000801')$$,
  '28000', 'authentication required',
  'clearing without a session is rejected'
);

-- ---------------------------------------------------------------------------
-- A clears the chat
-- ---------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000611';

SELECT extensions.ok(
  public.clear_conversation_history('00000000-0000-4000-8000-000000000801') IS NOT NULL,
  'a participant can clear; the function returns the server timestamp'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.conversation_clears),
  1,
  'A can see exactly their own clear marker'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.string_agg(user_id::text, ',') FROM public.conversation_clears),
  '00000000-0000-4000-8000-000000000611',
  'only A''s row exists: B has no marker'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.messages
    WHERE conversation_id = '00000000-0000-4000-8000-000000000801'),
  2,
  'nothing is deleted: both messages still exist'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000612';

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.conversation_clears),
  0,
  'B cannot see that A cleared the chat (the marker is owner-only)'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.messages
    WHERE conversation_id = '00000000-0000-4000-8000-000000000801'),
  2,
  'B still sees every message: clearing affects only the clearer''s view'
);

-- ---------------------------------------------------------------------------
-- Who may clear, and how
-- ---------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000613';

SELECT extensions.throws_ok(
  $$SELECT public.clear_conversation_history('00000000-0000-4000-8000-000000000801')$$,
  '42501', 'not a participant of this conversation',
  'an outsider cannot clear someone else''s conversation'
);

SELECT extensions.throws_ok(
  $$SELECT public.clear_conversation_history('99999999-9999-4999-8999-999999999999')$$,
  '42501', 'not a participant of this conversation',
  'clearing a conversation that does not exist is rejected'
);

SELECT extensions.throws_ok(
  $$SELECT public.clear_conversation_history(NULL)$$,
  '42501', 'not a participant of this conversation',
  'a NULL conversation is rejected'
);

SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000611';

SELECT extensions.throws_ok(
  $$INSERT INTO public.conversation_clears (conversation_id, user_id, cleared_at)
    VALUES ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000611', now())$$,
  '42501', NULL,
  'a client cannot write the table directly (no INSERT)'
);

SELECT extensions.throws_ok(
  $$UPDATE public.conversation_clears SET cleared_at = '2000-01-01'$$,
  '42501', NULL,
  'a client cannot rewrite the marker (no UPDATE)'
);

SELECT extensions.throws_ok(
  $$DELETE FROM public.conversation_clears$$,
  '42501', NULL,
  'a client cannot delete the marker (no DELETE)'
);

RESET ROLE;

-- Clearing again only ever moves the marker forward.
UPDATE public.conversation_clears
   SET cleared_at = pg_catalog.clock_timestamp() + interval '1 hour'
 WHERE user_id = '00000000-0000-4000-8000-000000000611';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000611';
SELECT public.clear_conversation_history('00000000-0000-4000-8000-000000000801');
RESET ROLE;

SELECT extensions.ok(
  (SELECT cleared_at > pg_catalog.clock_timestamp() + interval '59 minutes'
     FROM public.conversation_clears
    WHERE user_id = '00000000-0000-4000-8000-000000000611'),
  'the marker never moves backwards'
);

-- B clears independently
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000612';
SELECT public.clear_conversation_history('00000000-0000-4000-8000-000000000801');
RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.conversation_clears),
  2,
  'each participant has their own independent marker'
);

-- Deleting the conversation removes the markers with it
DELETE FROM public.conversations WHERE id = '00000000-0000-4000-8000-000000000801';

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.conversation_clears),
  0,
  'markers are removed when the conversation is deleted'
);

SELECT * FROM extensions.finish();

ROLLBACK;
