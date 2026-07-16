-- ============================================================================
-- 20260703121600_harden_direct_chat_creation.sql
--
-- Make the database the only creation boundary for one-to-one conversations.
-- The browser supplies only the intended partner; the RPC derives the caller
-- from auth.uid(), serializes the unordered user pair, and atomically creates
-- exactly two participant rows when no direct conversation already exists.
--
-- Existing conversations and participants are intentionally left untouched.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_pair_key text;
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

  -- conversation_participants.user_id references auth.users(id), and
  -- profiles.id is the repository's auth-user-backed profile key.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_partner_id
  ) THEN
    RAISE EXCEPTION 'partner profile does not exist'
      USING ERRCODE = '23503';
  END IF;

  -- Serialize all creation attempts for the same unordered pair until the
  -- surrounding transaction ends. Hash collisions only serialize unrelated
  -- pairs; they cannot weaken correctness.
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

-- RLS policies call this helper as authenticated users, so authenticated keeps
-- EXECUTE. Anonymous and implicit PUBLIC execution are unnecessary.
ALTER FUNCTION public.is_conversation_participant(uuid) SET search_path = '';
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

-- Direct creation is no longer a supported client operation. Drop every known
-- historical INSERT policy name and revoke the underlying table privilege.
DROP POLICY IF EXISTS "Users can insert participants to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert_self_or_creator" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert_creator_only" ON public.conversation_participants;

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;

REVOKE INSERT ON TABLE public.conversations FROM authenticated, anon;
REVOKE INSERT ON TABLE public.conversation_participants FROM authenticated, anon;
