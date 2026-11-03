-- ============================================================================
-- 20261103121000_clear_conversation_history.sql
--
-- Backs the chat menu's "Clear Chat" (previously a placeholder alert()).
--
-- SEMANTICS: clearing hides the conversation's CURRENT messages from the
-- caller's own view only (WhatsApp-style). Nothing is deleted and the other
-- participant is unaffected: they keep every message. Messages sent or received
-- after the clear appear normally. The app applies the marker on read.
--
-- Deliberately NOT "delete for everyone": that would remove messages the other
-- person wrote, which this project forbids (AGENTS.md: never modify another
-- user's messages), and messages have no DELETE policy by design.
--
-- WHY A NEW TABLE and not a column on conversation_participants: that table's
-- rows are readable by BOTH participants, so a cleared_at there would let the
-- other person read, through the API, when you cleared the chat. This table is
-- readable only by its owner (RLS: user_id = auth.uid()) and written only via
-- the function below.
--
-- The marker is server time, so it works across devices and is compared with
-- messages.created_at (also server time), never with the client's clock.
--
-- ROLLOUT: ADDITIVE. The app reads the table tolerantly (a failed read just
-- means "nothing cleared"), so deploying the code before this migration does
-- not break chat; Clear Chat itself reports an error until the function exists.
-- Idempotent / rerun-safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_clears (
  conversation_id uuid NOT NULL
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  cleared_at      timestamptz NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_clears_user_idx
  ON public.conversation_clears (user_id);

ALTER TABLE public.conversation_clears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_clears_select_own ON public.conversation_clears;
CREATE POLICY conversation_clears_select_own
  ON public.conversation_clears FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy or grant: writes go through the function only.

REVOKE ALL ON TABLE public.conversation_clears FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.conversation_clears TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_conversation_history(p_conversation_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now     timestamptz := pg_catalog.clock_timestamp();
  v_cleared timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_conversation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.conversation_participants AS cp
     WHERE cp.conversation_id = p_conversation_id
       AND cp.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'not a participant of this conversation'
      USING ERRCODE = '42501';
  END IF;

  -- Only ever moves forward, and only touches the caller's own row.
  INSERT INTO public.conversation_clears (conversation_id, user_id, cleared_at)
  VALUES (p_conversation_id, v_user_id, v_now)
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET cleared_at = GREATEST(public.conversation_clears.cleared_at, EXCLUDED.cleared_at)
  RETURNING cleared_at INTO v_cleared;

  RETURN v_cleared;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_conversation_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_conversation_history(uuid) TO authenticated;
