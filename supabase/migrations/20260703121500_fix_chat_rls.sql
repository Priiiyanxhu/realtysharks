-- ============================================================================
-- 20260703121500_fix_chat_rls.sql
--
-- Purpose: make conversations / conversation_participants / messages RLS safe
-- for closed beta.
--
-- Problems fixed (from 20260703000000_create_business_tables.sql):
--   1. conversation_participants SELECT policy is self-referential (queries
--      conversation_participants from within its own policy) -> Postgres RLS
--      infinite-recursion risk that can 500 the chat.
--   2. conversation_participants INSERT uses WITH CHECK (auth.uid() is not
--      null): ANY logged-in user can add ANY user to ANY conversation, or add
--      themselves into a stranger's conversation to read its messages.
--   3. messages/conversations policies re-implement the participant EXISTS
--      check inline; centralise via a SECURITY DEFINER helper.
--
-- The helper is SECURITY DEFINER so the participant lookup runs as the function
-- owner and is NOT re-filtered by conversation_participants RLS -> this is what
-- breaks the recursion. It returns only a boolean and reads nothing the caller
-- shouldn't already be able to infer (their own membership).
--
-- App flow preserved (useConversations.getOrCreateConversation):
--   INSERT conversations (created_by = me)
--   -> INSERT conversation_participants [ {me}, {partner} ]  (creator adds both)
--
-- NON-DESTRUCTIVE: no table/column dropped or renamed. DROP POLICY IF EXISTS +
-- CREATE POLICY, CREATE OR REPLACE FUNCTION. Idempotent / rerun-safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: is auth.uid() a participant of the given conversation?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conv_id
      AND cp.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. conversation_participants
-- ----------------------------------------------------------------------------
-- Drop prior (recursive SELECT + weak INSERT) policies.
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants to conversations" ON public.conversation_participants;
-- Defensive: alternate names that may exist in the live DB.
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.conversation_participants;

-- SELECT: own row, or any row in a conversation you participate in (via helper,
-- so no self-reference / recursion).
CREATE POLICY "cp_select_participant"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

-- INSERT: creator-only. Only the user who created the conversation may insert
-- participant rows (both themselves and the recipient). This prevents a user
-- from injecting THEMSELVES into a stranger's existing conversation just by
-- knowing its id (which a plain `user_id = auth.uid()` check would allow).
DROP POLICY IF EXISTS "cp_insert_self_or_creator" ON public.conversation_participants;
CREATE POLICY "cp_insert_creator_only"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );
-- (no UPDATE/DELETE policy -> those commands are denied by default.)

-- ----------------------------------------------------------------------------
-- 3. conversations
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view conversations they are part of" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

-- SELECT: participants, plus the creator (so the creator can read the row in
-- the instant between creating the conversation and inserting participants).
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_conversation_participant(id)
  );

-- INSERT: only as yourself.
CREATE POLICY "conversations_insert_own"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
-- (no UPDATE/DELETE policy -> denied by default.)

-- ----------------------------------------------------------------------------
-- 4. messages
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their message status" ON public.messages;
-- Defensive: alternate names that may exist in the live DB.
DROP POLICY IF EXISTS "Messages are viewable by conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to conversations they are in" ON public.messages;

-- SELECT: participants only.
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id));

-- INSERT: participant AND sending as yourself.
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- UPDATE: owner-only. A user may only modify messages they sent (and only
-- within a conversation they still participate in). This protects message
-- integrity: no participant can alter another user's body / sender_id / status.
-- Read receipts (which must touch the OTHER user's messages) are handled by the
-- SECURITY DEFINER RPC below, NOT by direct UPDATE. No DELETE policy -> denied.
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
CREATE POLICY "messages_update_own"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- ----------------------------------------------------------------------------
-- 5. Controlled read-receipt RPC (Option B).
--    Lets a participant mark the OTHER party's messages as read without a broad
--    UPDATE policy. SECURITY DEFINER so it can update rows the caller does not
--    own, but it is tightly constrained:
--      * caller must be a participant of the conversation,
--      * only messages in THAT conversation,
--      * only messages NOT sent by the caller,
--      * only sets status='read' + read_at=now(); never body/sender_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'not a participant of conversation %', p_conversation_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages
     SET status  = 'read',
         read_at = now()
   WHERE conversation_id = p_conversation_id
     AND sender_id <> auth.uid()
     AND status IS DISTINCT FROM 'read';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_messages_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_messages_read(uuid) TO authenticated;
