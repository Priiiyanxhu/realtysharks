BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(30);

-- ---------------------------------------------------------------------------
-- Structure and grants
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.user_blocks'::pg_catalog.regclass),
  'RLS is enabled on user_blocks'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_blocks'
  ),
  'user_blocks_delete_own,user_blocks_insert_own,user_blocks_select_own',
  'user_blocks has exactly select / insert / delete owner policies'
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
      'authenticated', 'public.user_blocks', privilege_name
    )
  ),
  'DELETE,INSERT,SELECT',
  'authenticated has only SELECT, INSERT, DELETE on user_blocks'
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
      'anon', 'public.user_blocks', privilege_name
    )
  ),
  NULL::text,
  'anon has no user_blocks privileges'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon', 'public.is_chat_blocked(uuid)', 'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated', 'public.is_chat_blocked(uuid)', 'EXECUTE'
  ),
  'is_chat_blocked is executable by authenticated only'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
  ),
  'messages_insert_participant,messages_select_participant,messages_update_own',
  'messages still has exactly its three policies'
);

-- ---------------------------------------------------------------------------
-- Fixtures: A, B, C onboarded; D not onboarded; E starts many chats;
-- 20 extra onboarded recipients.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'chat-restrict-' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'Restrict ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM pg_catalog.generate_series(571, 575) AS n;

-- 20 recipients: 0600 .. 0619
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  ('00000000-0000-4000-8000-00000000' || pg_catalog.lpad(n::text, 4, '0'))::uuid,
  'authenticated', 'authenticated',
  'chat-restrict-r' || n || '@example.invalid', '{}'::jsonb,
  pg_catalog.jsonb_build_object('full_name', 'Recipient ' || n),
  pg_catalog.now(), pg_catalog.now()
FROM pg_catalog.generate_series(600, 620) AS n;

-- 571 A, 572 B, 573 C, 574 D (NOT onboarded), 575 E; 600..620 recipients.
UPDATE public.profiles
   SET onboarded = true
 WHERE id <> '00000000-0000-4000-8000-000000000574'
   AND id::text LIKE '00000000-0000-4000-8000-00000000%';

-- ---------------------------------------------------------------------------
-- Onboarding gate
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000574';

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000571')$$,
  '42501', 'complete onboarding before starting conversations',
  'a non-onboarded caller cannot start a conversation'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000571';

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000574')$$,
  '42501', 'this user cannot be messaged',
  'cannot start a conversation with a non-onboarded recipient'
);

-- Happy path A -> B, and reuse.
SELECT extensions.lives_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572')$$,
  'onboarded A can start a conversation with onboarded B'
);

SELECT extensions.is(
  public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572'),
  public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572'),
  'asking again returns the same conversation'
);

SELECT extensions.lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572'),
            '00000000-0000-4000-8000-000000000571', 'hello B')$$,
  'A can message B before any block'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Blocks: visibility and ownership rules of the table itself
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000572';

SELECT extensions.lives_ok(
  $$INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES ('00000000-0000-4000-8000-000000000572',
            '00000000-0000-4000-8000-000000000571')$$,
  'B can block A'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES ('00000000-0000-4000-8000-000000000572',
            '00000000-0000-4000-8000-000000000572')$$,
  '42501', NULL,
  'a user cannot block themselves'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES ('00000000-0000-4000-8000-000000000573',
            '00000000-0000-4000-8000-000000000571')$$,
  '42501', NULL,
  'a user cannot create a block on behalf of someone else'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000571';

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.user_blocks),
  0,
  'A cannot see that B blocked them'
);

-- A (blocked) cannot message B in the EXISTING conversation, and cannot start anew.
SELECT extensions.throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572'),
            '00000000-0000-4000-8000-000000000571', 'still there?')$$,
  '42501', NULL,
  'a blocked sender cannot message through an existing conversation'
);

SELECT extensions.lives_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572')$$,
  'a blocked user can still open the existing conversation (history is not hidden)'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::int FROM public.messages),
  1,
  'message history stays readable to the blocked user'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000572';

SELECT extensions.throws_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000571'),
            '00000000-0000-4000-8000-000000000572', 'reply')$$,
  '42501', NULL,
  'the blocker cannot message the blocked user either (block is symmetric)'
);

-- Unblock restores messaging.
SELECT extensions.lives_ok(
  $$DELETE FROM public.user_blocks
     WHERE blocker_id = '00000000-0000-4000-8000-000000000572'
       AND blocked_id = '00000000-0000-4000-8000-000000000571'$$,
  'B can remove their block'
);

SELECT extensions.lives_ok(
  $$INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000571'),
            '00000000-0000-4000-8000-000000000572', 'back again')$$,
  'after unblocking, messaging works again'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Blocks stop NEW conversations in both directions, with one generic error
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000573';

SELECT extensions.lives_ok(
  $$INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES ('00000000-0000-4000-8000-000000000573',
            '00000000-0000-4000-8000-000000000571')$$,
  'C blocks A'
);

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000571')$$,
  '42501', 'this user cannot be messaged',
  'the blocker cannot start a conversation with the user they blocked'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000571';

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000573')$$,
  '42501', 'this user cannot be messaged',
  'a blocked user cannot start a conversation (same error as non-onboarded)'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Daily cap: 20 new conversations per rolling 24h
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000575';

SELECT extensions.is(
  (SELECT pg_catalog.count(public.get_or_create_direct_conversation(id))::int
     FROM public.profiles
    WHERE id::text >= '00000000-0000-4000-8000-000000000600'
      AND id::text <  '00000000-0000-4000-8000-000000000620'),
  20,
  'E can start 20 new conversations in a day'
);

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000620')$$,
  '54000', 'daily new conversation limit reached',
  'the 21st new conversation in 24h is refused'
);

SELECT extensions.lives_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000600')$$,
  'at the cap, reopening an existing conversation still works'
);

RESET ROLE;

-- Age one of E's conversations out of the rolling window.
UPDATE public.conversations
   SET created_at = pg_catalog.now() - interval '25 hours'
 WHERE id = (
   SELECT c.id FROM public.conversations c
    WHERE c.created_by = '00000000-0000-4000-8000-000000000575'
    ORDER BY c.id LIMIT 1
 );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000575';

SELECT extensions.lives_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000620')$$,
  'once an old conversation leaves the 24h window, E can start another'
);

SELECT extensions.throws_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000572')$$,
  '54000', 'daily new conversation limit reached',
  'the cap applies again right after (still 20 in the window)'
);

RESET ROLE;

-- The cap is per caller: A is unaffected by E's usage.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000571';

SELECT extensions.lives_ok(
  $$SELECT public.get_or_create_direct_conversation('00000000-0000-4000-8000-000000000600')$$,
  'the daily cap is per caller'
);

RESET ROLE;

SELECT * FROM extensions.finish();

ROLLBACK;
