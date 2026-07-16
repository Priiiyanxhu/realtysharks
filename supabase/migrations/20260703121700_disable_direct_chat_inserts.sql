-- ============================================================================
-- 20260703121700_disable_direct_chat_inserts.sql
--
-- Final rollout step after the RPC-based frontend is deployed and verified.
-- Remove every policy that can authorize direct INSERTs into conversations or
-- conversation_participants, including live policies created outside source
-- control, then revoke the underlying table privilege from all client roles.
--
-- Existing conversations and participant rows are not modified.
-- ============================================================================

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'conversation_participants')
      AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

REVOKE INSERT ON TABLE public.conversations FROM PUBLIC, authenticated, anon;
REVOKE INSERT ON TABLE public.conversation_participants FROM PUBLIC, authenticated, anon;
