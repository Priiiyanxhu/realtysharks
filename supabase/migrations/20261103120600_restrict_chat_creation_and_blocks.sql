-- ============================================================================
-- 20261103120600_restrict_chat_creation_and_blocks.sql
--
-- Problem: get_or_create_direct_conversation(p_partner_id) (20260703121600)
-- lets ANY authenticated user open a conversation with ANY other user, with no
-- consent, throttle or block. In a network sold as trusted and invite-worthy
-- that is a spam / harassment vector: one account can cold-message every
-- broker and the recipient has no recourse.
--
-- Rule implemented (product decision: gate + throttle + blocks):
--
--   Starting a NEW conversation requires that
--     1. the caller has completed onboarding (profiles.onboarded),
--     2. the recipient has completed onboarding,
--     3. neither side has blocked the other,
--     4. the caller has started fewer than 20 new conversations in the last
--        rolling 24 hours (c_daily_new_conversation_limit below).
--
--   Unchanged: returning an EXISTING conversation for the pair is always
--   allowed and does not count toward the cap, so reopening or replying in
--   current chats is unlimited. Nothing here deletes or edits existing
--   conversations or messages.
--
--   Blocks are enforced for messages too, not just at conversation start:
--   when either participant has blocked the other, neither can INSERT a new
--   message into their conversation (history stays readable). Otherwise a
--   blocked sender could keep messaging through a conversation that already
--   existed.
--
-- Error contract (SQLSTATE / message), so the app can map them to UX later:
--   42501 'complete onboarding before starting conversations'
--   42501 'this user cannot be messaged'      -- recipient not onboarded OR a
--                                                block in either direction;
--                                                deliberately not distinguished,
--                                                so a blocked user cannot tell.
--   54000 'daily new conversation limit reached'
--
-- Blocks: public.user_blocks (blocker_id, blocked_id). Owners manage their own
-- rows directly under RLS. A user can read only the blocks THEY created, never
-- who has blocked them. SECURITY DEFINER helpers read both directions.
--
-- The daily limit is the constant c_daily_new_conversation_limit in the
-- function below; change it with a CREATE OR REPLACE of that one line.
--
-- Rollout: apply together with (or before) any UI that adds block/unblock. The
-- app needs NO change to keep working: failures already surface through the
-- existing "Failed to create conversation" alert and a failed send.
--
-- Idempotent / rerun-safe. NON-DESTRUCTIVE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Block list
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx
  ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());
-- No UPDATE policy/grant: a block is created or removed, never edited.

REVOKE ALL ON TABLE public.user_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_blocks TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Quota index (the cap query filters on created_by + created_at)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS conversations_created_by_created_at_idx
  ON public.conversations (created_by, created_at);

-- ----------------------------------------------------------------------------
-- 3. Block check for message policies. SECURITY DEFINER so it can read blocks
--    the caller can't see under RLS (blocks placed AGAINST them). It only ever
--    answers about conversations the caller participates in.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_chat_blocked(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants AS me
    JOIN public.conversation_participants AS other
      ON other.conversation_id = me.conversation_id
     AND other.user_id <> me.user_id
    JOIN public.user_blocks AS b
      ON (b.blocker_id = me.user_id AND b.blocked_id = other.user_id)
      OR (b.blocker_id = other.user_id AND b.blocked_id = me.user_id)
    WHERE me.conversation_id = p_conversation_id
      AND me.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_blocked(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Messages: a block in either direction stops new messages.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
    AND NOT public.is_chat_blocked(conversation_id)
  );

-- ----------------------------------------------------------------------------
-- 5. Conversation creation: gate, block check and rolling daily cap.
--    Body is the 20260703121600 function plus the new-conversation checks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_daily_new_conversation_limit constant integer := 20;
  c_quota_window constant interval := interval '24 hours';

  v_current_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_pair_key text;
  v_recent_new_conversations integer;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'caller profile does not exist'
      USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'partner id is required'
      USING ERRCODE = '22004';
  END IF;

  IF p_partner_id = v_current_user_id THEN
    RAISE EXCEPTION 'cannot create a direct conversation with yourself'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_partner_id
  ) THEN
    RAISE EXCEPTION 'partner profile does not exist'
      USING ERRCODE = '23503';
  END IF;

  -- Serialize this caller's creations so concurrent calls can't slip past the
  -- cap together, then the unordered pair so the same two users can't create
  -- duplicates. Always taken in this order, so there is no lock cycle.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'realtysharks:chat-quota:' || v_current_user_id::text, 0
    )
  );

  v_pair_key := CASE
    WHEN v_current_user_id::text < p_partner_id::text
      THEN v_current_user_id::text || ':' || p_partner_id::text
    ELSE p_partner_id::text || ':' || v_current_user_id::text
  END;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realtysharks:direct-chat:' || v_pair_key, 0)
  );

  -- Reuse only a conversation whose complete participant set is this pair.
  -- Conversations with zero, one, or more than two participants are ignored.
  -- Reopening an existing chat is always allowed and is never counted.
  SELECT c.id
    INTO v_conversation_id
    FROM public.conversations c
    JOIN public.conversation_participants cp
      ON cp.conversation_id = c.id
  GROUP BY c.id, c.created_at
  HAVING pg_catalog.count(*) = 2
     AND pg_catalog.count(*) FILTER (
       WHERE cp.user_id = v_current_user_id
     ) = 1
     AND pg_catalog.count(*) FILTER (
       WHERE cp.user_id = p_partner_id
     ) = 1
   ORDER BY c.created_at ASC NULLS LAST, c.id
   LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- ---- Starting a NEW conversation from here on ----

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_current_user_id
      AND p.onboarded IS TRUE
  ) THEN
    RAISE EXCEPTION 'complete onboarding before starting conversations'
      USING ERRCODE = '42501';
  END IF;

  -- Recipient not onboarded and "blocked in either direction" share one error
  -- on purpose: a blocked user must not be able to tell they were blocked.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_partner_id
      AND p.onboarded IS TRUE
  ) OR EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = v_current_user_id AND b.blocked_id = p_partner_id)
       OR (b.blocker_id = p_partner_id AND b.blocked_id = v_current_user_id)
  ) THEN
    RAISE EXCEPTION 'this user cannot be messaged'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_recent_new_conversations
    FROM public.conversations c
   WHERE c.created_by = v_current_user_id
     AND c.created_at > pg_catalog.now() - c_quota_window;

  IF v_recent_new_conversations >= c_daily_new_conversation_limit THEN
    RAISE EXCEPTION 'daily new conversation limit reached'
      USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.conversations (created_by)
  VALUES (v_current_user_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES
    (v_conversation_id, v_current_user_id),
    (v_conversation_id, p_partner_id);

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
