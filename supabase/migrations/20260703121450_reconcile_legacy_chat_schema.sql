-- ============================================================================
-- 20260703121450_reconcile_legacy_chat_schema.sql
--
-- Reconcile the legacy sender/receiver chat schema with the normalized direct
-- conversation model expected by the application and later chat migrations.
--
-- IMPORTANT: apply this migration and 20260703121500_fix_chat_rls.sql
-- consecutively. This migration removes all chat policies as its final step,
-- deliberately leaving chat fail-closed until 121500 installs reviewed RLS.
--
-- The migration is transactional, non-destructive, idempotent, and rerun-safe.
-- Legacy columns and all message rows/content are preserved.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Preflight: prove the source tables and legacy identities are safe before
--    making any schema or data change. Error messages never include content.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  has_receiver_id boolean;
  has_content boolean;
  invalid_rows_exist boolean;
BEGIN
  IF pg_catalog.to_regclass('public.conversations') IS NULL THEN
    RAISE EXCEPTION 'chat reconciliation requires public.conversations';
  END IF;

  IF pg_catalog.to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'chat reconciliation requires public.messages';
  END IF;

  IF pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'chat reconciliation requires public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'sender_id'
  ) THEN
    RAISE EXCEPTION 'chat reconciliation requires public.messages.sender_id';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) INTO has_receiver_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'content'
  ) INTO has_content;

  IF has_receiver_id IS DISTINCT FROM has_content THEN
    RAISE EXCEPTION
      'legacy messages schema is incomplete: receiver_id and content must coexist';
  END IF;

  IF has_receiver_id THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.sender_id IS NULL
           OR m.receiver_id IS NULL
           OR m.sender_id = m.receiver_id
      )
    $sql$ INTO invalid_rows_exist;

    IF invalid_rows_exist THEN
      RAISE EXCEPTION
        'legacy messages contain null participants or self-directed messages';
    END IF;

    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = m.sender_id
              )
           OR NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = m.receiver_id
              )
      )
    $sql$ INTO invalid_rows_exist;

    IF invalid_rows_exist THEN
      RAISE EXCEPTION
        'legacy messages reference a sender or receiver without a profile';
    END IF;
  END IF;
END;
$preflight$;

-- ----------------------------------------------------------------------------
-- 2. Reconcile conversations. profiles.id is backed by auth.users(id), and the
--    normalized chat tables use auth.users(id) for every participant identity.
-- ----------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid;

DO $created_by_fk$
DECLARE
  created_by_attnum smallint;
BEGIN
  SELECT attnum
    INTO created_by_attnum
    FROM pg_catalog.pg_attribute
   WHERE attrelid = 'public.conversations'::pg_catalog.regclass
     AND attname = 'created_by'
     AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.conversations'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::pg_catalog.regclass
      AND c.conkey = ARRAY[created_by_attnum]::smallint[]
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_created_by_auth_user_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END;
$created_by_fk$;

-- Legacy pair columns are preserved but must not block RPC inserts that supply
-- only created_by. Fresh normalized schemas may not have these columns.
DO $relax_legacy_conversations$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'participant_1_id'
  ) THEN
    EXECUTE
      'ALTER TABLE public.conversations ALTER COLUMN participant_1_id DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'participant_2_id'
  ) THEN
    EXECUTE
      'ALTER TABLE public.conversations ALTER COLUMN participant_2_id DROP NOT NULL';
  END IF;
END;
$relax_legacy_conversations$;

-- ----------------------------------------------------------------------------
-- 3. Create the normalized participant table when absent. On fresh databases
--    this is a no-op because the repository-native table already exists.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT pg_catalog.now(),
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx
  ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx
  ON public.conversation_participants(conversation_id);

-- ----------------------------------------------------------------------------
-- 4. Materialize each unordered legacy pair and deterministically choose the
--    earliest sender as created_by (created_at ASC NULLS LAST, then id).
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE chat_legacy_pairs (
  lower_user_id uuid NOT NULL,
  higher_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  first_message_at timestamptz,
  last_message_at timestamptz,
  PRIMARY KEY (lower_user_id, higher_user_id)
) ON COMMIT DROP;

DO $collect_legacy_pairs$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) THEN
    EXECUTE $sql$
      INSERT INTO pg_temp.chat_legacy_pairs (
        lower_user_id,
        higher_user_id,
        created_by,
        first_message_at,
        last_message_at
      )
      SELECT
        LEAST(m.sender_id, m.receiver_id),
        GREATEST(m.sender_id, m.receiver_id),
        (array_agg(
          m.sender_id
          ORDER BY m.created_at ASC NULLS LAST, m.id ASC
        ))[1],
        (array_agg(
          m.created_at
          ORDER BY m.created_at ASC NULLS LAST, m.id ASC
        ))[1],
        max(m.created_at)
      FROM public.messages m
      GROUP BY
        LEAST(m.sender_id, m.receiver_id),
        GREATEST(m.sender_id, m.receiver_id)
      ON CONFLICT (lower_user_id, higher_user_id) DO NOTHING
    $sql$;
  END IF;
END;
$collect_legacy_pairs$;

CREATE TEMP TABLE chat_pair_conversations (
  lower_user_id uuid NOT NULL,
  higher_user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  PRIMARY KEY (lower_user_id, higher_user_id),
  UNIQUE (conversation_id)
) ON COMMIT DROP;

DO $reconstruct_conversations$
DECLARE
  pair_record record;
  exact_match_count bigint;
  selected_conversation_id uuid;
  has_legacy_pair_columns boolean;
  has_last_message_at boolean;
BEGIN
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'participant_1_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'participant_2_id'
    )
  INTO has_legacy_pair_columns;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'last_message_at'
  ) INTO has_last_message_at;

  FOR pair_record IN
    SELECT *
    FROM pg_temp.chat_legacy_pairs
    ORDER BY lower_user_id, higher_user_id
  LOOP
    SELECT
      pg_catalog.count(*),
      (pg_catalog.array_agg(
        direct_conversation.id
        ORDER BY direct_conversation.created_at ASC NULLS LAST,
                 direct_conversation.id ASC
      ))[1]
    INTO exact_match_count, selected_conversation_id
    FROM (
      SELECT c.id, c.created_at
      FROM public.conversations c
      JOIN public.conversation_participants cp
        ON cp.conversation_id = c.id
      GROUP BY c.id, c.created_at
      HAVING pg_catalog.count(*) = 2
         AND pg_catalog.count(*) FILTER (
           WHERE cp.user_id = pair_record.lower_user_id
         ) = 1
         AND pg_catalog.count(*) FILTER (
           WHERE cp.user_id = pair_record.higher_user_id
         ) = 1
    ) AS direct_conversation;

    IF exact_match_count > 1 THEN
      RAISE EXCEPTION
        'multiple normalized conversations exist for a legacy message pair';
    END IF;

    IF exact_match_count = 0 THEN
      INSERT INTO public.conversations (
        created_by,
        created_at,
        updated_at
      ) VALUES (
        pair_record.created_by,
        COALESCE(pair_record.first_message_at, pg_catalog.now()),
        COALESCE(pair_record.first_message_at, pg_catalog.now())
      )
      RETURNING id INTO selected_conversation_id;
    END IF;

    IF has_legacy_pair_columns THEN
      EXECUTE $sql$
        UPDATE public.conversations
           SET participant_1_id = COALESCE(participant_1_id, $1),
               participant_2_id = COALESCE(participant_2_id, $2)
         WHERE id = $3
      $sql$
      USING
        pair_record.lower_user_id,
        pair_record.higher_user_id,
        selected_conversation_id;
    END IF;

    IF has_last_message_at AND pair_record.last_message_at IS NOT NULL THEN
      EXECUTE $sql$
        UPDATE public.conversations
           SET last_message_at = CASE
                 WHEN last_message_at IS NULL OR last_message_at < $1 THEN $1
                 ELSE last_message_at
               END
         WHERE id = $2
      $sql$
      USING pair_record.last_message_at, selected_conversation_id;
    END IF;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES
      (selected_conversation_id, pair_record.lower_user_id),
      (selected_conversation_id, pair_record.higher_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    INSERT INTO pg_temp.chat_pair_conversations (
      lower_user_id,
      higher_user_id,
      conversation_id
    ) VALUES (
      pair_record.lower_user_id,
      pair_record.higher_user_id,
      selected_conversation_id
    )
    ON CONFLICT (lower_user_id, higher_user_id) DO UPDATE
      SET conversation_id = EXCLUDED.conversation_id;
  END LOOP;
END;
$reconstruct_conversations$;

-- Every conversation must now have a valid creator before restoring the
-- normalized NOT NULL invariant.
DO $assert_conversation_creators$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.conversations WHERE created_by IS NULL
  ) THEN
    RAISE EXCEPTION
      'chat reconciliation found a conversation without a deterministic creator';
  END IF;
END;
$assert_conversation_creators$;

ALTER TABLE public.conversations
  ALTER COLUMN created_by SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Reconcile messages without deleting or rewriting legacy content.
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS body text;

DO $backfill_legacy_messages$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'content'
  ) THEN
    EXECUTE $sql$
      UPDATE public.messages
         SET body = content
       WHERE body IS NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.messages m
         SET conversation_id = pair_conversation.conversation_id
        FROM pg_temp.chat_pair_conversations pair_conversation
       WHERE m.conversation_id IS NULL
         AND pair_conversation.lower_user_id = LEAST(m.sender_id, m.receiver_id)
         AND pair_conversation.higher_user_id = GREATEST(m.sender_id, m.receiver_id)
    $sql$;
  END IF;
END;
$backfill_legacy_messages$;

UPDATE public.messages
   SET status = 'sent'
 WHERE status IS NULL;

-- Assert normalized completeness and membership before tightening constraints.
DO $assert_messages$
DECLARE
  has_receiver_id boolean;
  invalid_rows_exist boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.messages
    WHERE conversation_id IS NULL
       OR body IS NULL
  ) THEN
    RAISE EXCEPTION
      'chat reconciliation could not backfill conversation_id or body for every message';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = m.conversation_id
    )
  ) THEN
    RAISE EXCEPTION
      'chat reconciliation mapped a message to a missing conversation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = m.conversation_id
        AND cp.user_id = m.sender_id
    )
  ) THEN
    RAISE EXCEPTION
      'chat reconciliation found a sender outside the mapped conversation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) INTO has_receiver_id;

  IF has_receiver_id THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE NOT EXISTS (
                SELECT 1
                FROM public.conversation_participants cp
                WHERE cp.conversation_id = m.conversation_id
                  AND cp.user_id = m.receiver_id
              )
           OR (
                SELECT pg_catalog.count(*)
                FROM public.conversation_participants cp
                WHERE cp.conversation_id = m.conversation_id
              ) <> 2
           OR (
                SELECT pg_catalog.count(*)
                FROM (
                  SELECT c.id
                  FROM public.conversations c
                  JOIN public.conversation_participants cp
                    ON cp.conversation_id = c.id
                  GROUP BY c.id
                  HAVING pg_catalog.count(*) = 2
                     AND pg_catalog.count(*) FILTER (
                       WHERE cp.user_id = m.sender_id
                     ) = 1
                     AND pg_catalog.count(*) FILTER (
                       WHERE cp.user_id = m.receiver_id
                     ) = 1
                ) AS exact_conversations
              ) <> 1
      )
    $sql$ INTO invalid_rows_exist;

    IF invalid_rows_exist THEN
      RAISE EXCEPTION
        'legacy message does not map to exactly one two-participant conversation';
    END IF;
  END IF;
END;
$assert_messages$;

DO $message_conversation_fk$
DECLARE
  conversation_id_attnum smallint;
BEGIN
  SELECT attnum
    INTO conversation_id_attnum
    FROM pg_catalog.pg_attribute
   WHERE attrelid = 'public.messages'::pg_catalog.regclass
     AND attname = 'conversation_id'
     AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.messages'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.conversations'::pg_catalog.regclass
      AND c.conkey = ARRAY[conversation_id_attnum]::smallint[]
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_id_reconciled_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END;
$message_conversation_fk$;

ALTER TABLE public.messages
  ALTER COLUMN conversation_id SET NOT NULL,
  ALTER COLUMN body SET NOT NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
  ON public.messages(conversation_id);

-- Legacy receiver_id/content remain intact for rollback visibility, but they
-- must be nullable so normalized inserts need only conversation_id/sender/body.
DO $relax_legacy_messages$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'receiver_id'
  ) THEN
    EXECUTE
      'ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'content'
  ) THEN
    EXECUTE
      'ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL';
  END IF;
END;
$relax_legacy_messages$;

-- ----------------------------------------------------------------------------
-- 6. Fail-closed policy transition. This runs last so any earlier error rolls
--    back all schema/data work and preserves the original policies.
-- ----------------------------------------------------------------------------
DO $drop_chat_policies$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'conversations',
        'conversation_participants',
        'messages'
      )
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$drop_chat_policies$;

COMMIT;
