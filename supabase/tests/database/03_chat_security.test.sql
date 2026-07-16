BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(17);

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

SELECT * FROM extensions.finish();

ROLLBACK;
