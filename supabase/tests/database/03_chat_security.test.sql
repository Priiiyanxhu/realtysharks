BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(42);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_participants'
  ),
  'cp_select_participant',
  'conversation_participants has exactly its final SELECT policy'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
  ),
  'conversations_select_participant',
  'conversations has exactly its final SELECT policy'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.string_agg(policyname, ',' ORDER BY policyname)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
  ),
  'messages_insert_participant,messages_select_participant,messages_update_own',
  'messages has exactly its final three policies'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_participants'
      AND policyname = 'cp_insert_creator_only'
  ),
  'cp_insert_creator_only is absent'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
      AND policyname = 'conversations_insert_own'
  ),
  'conversations_insert_own is absent'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege(
    'authenticated', 'public.conversations', 'INSERT'
  ),
  'authenticated cannot directly insert conversations'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege(
    'authenticated', 'public.conversation_participants', 'INSERT'
  ),
  'authenticated cannot directly insert conversation participants'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege('anon', 'public.conversations', 'INSERT'),
  'anon cannot directly insert conversations'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege(
    'anon', 'public.conversation_participants', 'INSERT'
  ),
  'anon cannot directly insert conversation participants'
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
      'anon', 'public.conversations', privilege_name
    )
  ),
  NULL::text,
  'anon has no conversations table privileges'
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
      'anon', 'public.conversation_participants', privilege_name
    )
  ),
  NULL::text,
  'anon has no conversation_participants table privileges'
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
      'anon', 'public.messages', privilege_name
    )
  ),
  NULL::text,
  'anon has no messages table privileges'
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
      'authenticated', 'public.conversations', privilege_name
    )
  ),
  'SELECT',
  'authenticated has only SELECT on conversations'
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
      'authenticated', 'public.conversation_participants', privilege_name
    )
  ),
  'SELECT',
  'authenticated has only SELECT on conversation_participants'
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
      'authenticated', 'public.messages', privilege_name
    )
  ),
  'INSERT,SELECT,UPDATE',
  'authenticated has only SELECT, INSERT, and UPDATE on messages'
);

SELECT extensions.ok(
  pg_catalog.to_regprocedure(
    'public.mark_conversation_messages_read(uuid)'
  ) IS NOT NULL,
  'read-receipt function exists'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.prosecdef
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.mark_conversation_messages_read(uuid)'::pg_catalog.regprocedure
  ),
  'read-receipt function remains SECURITY DEFINER'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.proconfig = ARRAY['search_path=""']::text[]
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.mark_conversation_messages_read(uuid)'::pg_catalog.regprocedure
  ),
  'read-receipt function has an empty search_path'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_or_create_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute direct conversation RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon', 'public.get_or_create_direct_conversation(uuid)', 'EXECUTE'
  ),
  'anon cannot execute direct conversation RPC'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.mark_conversation_messages_read(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute read-receipt RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon', 'public.mark_conversation_messages_read(uuid)', 'EXECUTE'
  ),
  'anon cannot execute read-receipt RPC'
);

INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000401',
    'authenticated', 'authenticated',
    'chat-user-a-401@example.invalid', '{}'::jsonb,
    '{"full_name":"Chat Test A"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    'authenticated', 'authenticated',
    'chat-user-b-402@example.invalid', '{}'::jsonb,
    '{"full_name":"Chat Test B"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  ),
  (
    '00000000-0000-4000-8000-000000000403',
    'authenticated', 'authenticated',
    'chat-user-c-403@example.invalid', '{}'::jsonb,
    '{"full_name":"Chat Test C"}'::jsonb,
    pg_catalog.now(), pg_catalog.now()
  );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000401';

SELECT extensions.is(
  public.get_or_create_direct_conversation(
    '00000000-0000-4000-8000-000000000402'
  ),
  public.get_or_create_direct_conversation(
    '00000000-0000-4000-8000-000000000402'
  ),
  'calling the direct conversation RPC twice returns the same UUID'
);

SELECT extensions.throws_ok(
  $sql$
    SELECT public.get_or_create_direct_conversation(
      '00000000-0000-4000-8000-000000000401'
    )
  $sql$,
  '22023',
  'cannot create a direct conversation with yourself',
  'self-chat requests are rejected'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT pg_catalog.count(*) FROM public.conversation_participants),
  2::bigint,
  'direct conversation contains exactly two participant rows'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.array_agg(user_id::text ORDER BY user_id::text)
    FROM public.conversation_participants
  ),
  ARRAY[
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000402'
  ]::text[],
  'direct conversation participant set is exactly user A and user B'
);

CREATE TEMPORARY TABLE chat_test_conversations (
  pair_name text PRIMARY KEY,
  conversation_id uuid NOT NULL
);

GRANT SELECT ON TABLE chat_test_conversations TO authenticated;

INSERT INTO chat_test_conversations (pair_name, conversation_id)
SELECT 'ab', conversation.id
FROM public.conversations AS conversation
JOIN public.conversation_participants AS participant
  ON participant.conversation_id = conversation.id
GROUP BY conversation.id
HAVING pg_catalog.count(*) = 2
   AND pg_catalog.count(*) FILTER (
     WHERE participant.user_id = '00000000-0000-4000-8000-000000000401'
   ) = 1
   AND pg_catalog.count(*) FILTER (
     WHERE participant.user_id = '00000000-0000-4000-8000-000000000402'
   ) = 1;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000401';

SELECT extensions.lives_ok(
  $sql$
    SELECT public.get_or_create_direct_conversation(
      '00000000-0000-4000-8000-000000000403'
    )
  $sql$,
  'user A can create the unrelated A-C direct conversation'
);

RESET ROLE;

INSERT INTO chat_test_conversations (pair_name, conversation_id)
SELECT 'ac', conversation.id
FROM public.conversations AS conversation
JOIN public.conversation_participants AS participant
  ON participant.conversation_id = conversation.id
GROUP BY conversation.id
HAVING pg_catalog.count(*) = 2
   AND pg_catalog.count(*) FILTER (
     WHERE participant.user_id = '00000000-0000-4000-8000-000000000401'
   ) = 1
   AND pg_catalog.count(*) FILTER (
     WHERE participant.user_id = '00000000-0000-4000-8000-000000000403'
   ) = 1;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000401';

SELECT extensions.throws_ok(
  $sql$
    INSERT INTO public.messages (id, conversation_id, sender_id, body)
    VALUES (
      '00000000-0000-4000-8000-000000000600',
      (SELECT conversation_id FROM pg_temp.chat_test_conversations
       WHERE pair_name = 'ab'),
      '00000000-0000-4000-8000-000000000402',
      'Spoofed sender message'
    )
  $sql$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'user A cannot insert a message while spoofing user B as sender'
);

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO public.messages (id, conversation_id, sender_id, body)
    VALUES (
      '00000000-0000-4000-8000-000000000601',
      (SELECT conversation_id FROM pg_temp.chat_test_conversations
       WHERE pair_name = 'ab'),
      '00000000-0000-4000-8000-000000000401',
      'Message from A to B'
    )
  $sql$,
  'user A can insert a message with their own sender id'
);

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO public.messages (id, conversation_id, sender_id, body)
    VALUES (
      '00000000-0000-4000-8000-000000000603',
      (SELECT conversation_id FROM pg_temp.chat_test_conversations
       WHERE pair_name = 'ac'),
      '00000000-0000-4000-8000-000000000401',
      'Unrelated A-C message'
    )
  $sql$,
  'user A can insert the unrelated-conversation control message'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000402';

SELECT extensions.lives_ok(
  $sql$
    INSERT INTO public.messages (id, conversation_id, sender_id, body)
    VALUES (
      '00000000-0000-4000-8000-000000000602',
      (SELECT conversation_id FROM pg_temp.chat_test_conversations
       WHERE pair_name = 'ab'),
      '00000000-0000-4000-8000-000000000402',
      'Message from B to A'
    )
  $sql$,
  'user B can insert their own message in the A-B conversation'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000403';

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM public.conversations
    WHERE id = (
      SELECT conversation_id FROM pg_temp.chat_test_conversations
      WHERE pair_name = 'ab'
    )
  ),
  0::bigint,
  'user C cannot select the A-B conversation'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM public.conversation_participants
    WHERE conversation_id = (
      SELECT conversation_id FROM pg_temp.chat_test_conversations
      WHERE pair_name = 'ab'
    )
  ),
  0::bigint,
  'user C cannot select A-B participant rows'
);

SELECT extensions.is(
  (
    SELECT pg_catalog.count(*)
    FROM public.messages
    WHERE conversation_id = (
      SELECT conversation_id FROM pg_temp.chat_test_conversations
      WHERE pair_name = 'ab'
    )
  ),
  0::bigint,
  'user C cannot select A-B messages'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000402';

SELECT extensions.lives_ok(
  $sql$
    UPDATE public.messages
       SET body = 'Unauthorized edit by B'
     WHERE id = '00000000-0000-4000-8000-000000000601'
  $sql$,
  'user B cross-sender update is safely filtered by RLS'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT body FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000601'),
  'Message from A to B',
  'user B cannot change user A message'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000401';

SELECT extensions.lives_ok(
  $sql$
    UPDATE public.messages
       SET body = 'Permitted edit by A'
     WHERE id = '00000000-0000-4000-8000-000000000601'
  $sql$,
  'user A own-message update is accepted by RLS'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT body FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000601'),
  'Permitted edit by A',
  'user A can change their own permitted message fields'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000402';

SELECT extensions.lives_ok(
  pg_catalog.format(
    'SELECT public.mark_conversation_messages_read(%L::uuid)',
    (
      SELECT conversation_id::text
      FROM pg_temp.chat_test_conversations
      WHERE pair_name = 'ab'
    )
  ),
  'user B can mark received messages in the A-B conversation as read'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT status FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000601'),
  'read',
  'user B read-receipt call marks user A message as read'
);

SELECT extensions.is(
  (SELECT status FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000602'),
  'sent',
  'user B read-receipt call does not change user B own message'
);

SELECT extensions.is(
  (SELECT status FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000603'),
  'sent',
  'read-receipt call does not change an unrelated-conversation message'
);

SELECT * FROM extensions.finish();

ROLLBACK;
