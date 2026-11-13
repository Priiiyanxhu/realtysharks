-- ============================================================================
-- 20261103120900_user_reports.sql
--
-- Backs the chat menu's "Report User". Until now that menu item was a
-- placeholder alert().
--
-- public.user_reports holds reports; public.report_user() is the only way for a
-- client to create one.
--
-- Privacy and safety properties:
--   * The reported person must never learn they were reported. The table has
--     RLS enabled with NO policies and no client grants, so no client role can
--     read or write it, including the reporter (they get a confirmation, not a
--     queue to browse) and certainly the reported user. Review happens with the
--     service_role key (Supabase dashboard / SQL editor / a future admin tool).
--   * Identity is auth.uid(); the reporter cannot be forged.
--   * Abuse limits: duplicates are collapsed (same reporter, same person, same
--     reason while a report is still 'open' returns 'duplicate' instead of a
--     new row), and a reporter may file at most 10 new reports per rolling 24h,
--     so the report button cannot be used to flood the queue.
--   * A conversation may be attached for context, but only one the reporter is
--     a participant of AND that includes the reported person. The reporter is
--     told, in the dialog, that the conversation may be reviewed.
--
-- WHO READS THESE: nothing in the app does yet. Until an admin tool exists,
-- review open reports from the SQL editor, e.g.
--     SELECT r.created_at, r.reason, r.details,
--            rp.full_name AS reporter, dp.full_name AS reported, r.conversation_id
--       FROM public.user_reports r
--       JOIN public.profiles rp ON rp.id = r.reporter_id
--       JOIN public.profiles dp ON dp.id = r.reported_id
--      WHERE r.status = 'open' ORDER BY r.created_at;
-- Set status to 'reviewed' | 'actioned' | 'dismissed' as you work through them
-- (service_role only; clients cannot change it).
--
-- Reasons are pinned in three places that must agree: the CHECK constraint
-- below, report_user(), and src/utils/userReports.ts (a unit test reads this
-- file and fails if the app's list drifts).
--
-- ROLLOUT: apply before deploying the Report dialog; without it the dialog's
-- submit fails with a generic "couldn't send" message (nothing else breaks).
-- ADDITIVE and idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason          text NOT NULL,
  details         text,
  status          text NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT user_reports_no_self_report CHECK (reporter_id <> reported_id),
  CONSTRAINT user_reports_reason_check CHECK (reason IN (
    'spam', 'harassment', 'scam_or_fraud', 'fake_profile',
    'inappropriate_content', 'other'
  )),
  CONSTRAINT user_reports_details_length CHECK (
    details IS NULL OR pg_catalog.char_length(details) <= 1000
  ),
  CONSTRAINT user_reports_status_check CHECK (status IN (
    'open', 'reviewed', 'actioned', 'dismissed'
  ))
);

CREATE INDEX IF NOT EXISTS user_reports_reporter_created_idx
  ON public.user_reports (reporter_id, created_at);
CREATE INDEX IF NOT EXISTS user_reports_reported_idx
  ON public.user_reports (reported_id);
CREATE INDEX IF NOT EXISTS user_reports_status_created_idx
  ON public.user_reports (status, created_at);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: no client role may read or write this table.

REVOKE ALL ON TABLE public.user_reports FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_id     uuid,
  p_reason          text,
  p_details         text DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_daily_limit constant integer  := 10;
  c_window      constant interval := interval '24 hours';

  v_reporter_id uuid := auth.uid();
  v_now         timestamptz := pg_catalog.clock_timestamp();
  v_details     text;
  v_count       integer;
  v_frees_at    timestamptz;
BEGIN
  IF v_reporter_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_reported_id IS NULL THEN
    RAISE EXCEPTION 'reported user is required' USING ERRCODE = '22004';
  END IF;

  IF p_reported_id = v_reporter_id THEN
    RAISE EXCEPTION 'cannot report yourself' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'spam', 'harassment', 'scam_or_fraud', 'fake_profile',
    'inappropriate_content', 'other'
  ) THEN
    RAISE EXCEPTION 'invalid report reason' USING ERRCODE = '22023';
  END IF;

  v_details := NULLIF(pg_catalog.btrim(p_details), '');

  IF v_details IS NOT NULL AND pg_catalog.char_length(v_details) > 1000 THEN
    RAISE EXCEPTION 'report details are too long' USING ERRCODE = '22023';
  END IF;

  IF p_reason = 'other' AND v_details IS NULL THEN
    RAISE EXCEPTION 'details are required when the reason is other'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_reported_id) THEN
    RAISE EXCEPTION 'reported user does not exist' USING ERRCODE = '23503';
  END IF;

  -- A conversation may only be attached if the reporter is in it AND the
  -- reported person is the other participant.
  IF p_conversation_id IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.conversation_participants AS cp
       WHERE cp.conversation_id = p_conversation_id
         AND cp.user_id = v_reporter_id
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants AS cp
       WHERE cp.conversation_id = p_conversation_id
         AND cp.user_id = p_reported_id
    )
  ) THEN
    RAISE EXCEPTION 'invalid conversation' USING ERRCODE = '42501';
  END IF;

  -- Serialize this reporter's calls so dedupe and the daily cap are atomic.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realtysharks:report-user:' || v_reporter_id::text, 0)
  );

  -- Duplicate: same reporter, same person, same reason, still open.
  IF EXISTS (
    SELECT 1 FROM public.user_reports AS r
     WHERE r.reporter_id = v_reporter_id
       AND r.reported_id = p_reported_id
       AND r.reason = p_reason
       AND r.status = 'open'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('status', 'duplicate');
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.user_reports AS r
   WHERE r.reporter_id = v_reporter_id
     AND r.created_at > v_now - c_window;

  IF v_count >= c_daily_limit THEN
    SELECT r.created_at + c_window
      INTO v_frees_at
      FROM public.user_reports AS r
     WHERE r.reporter_id = v_reporter_id
       AND r.created_at > v_now - c_window
     ORDER BY r.created_at ASC
    OFFSET (v_count - c_daily_limit) LIMIT 1;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds',
        GREATEST(1, pg_catalog.ceil(
          pg_catalog.date_part('epoch', v_frees_at - v_now))::integer)
    );
  END IF;

  INSERT INTO public.user_reports
    (reporter_id, reported_id, conversation_id, reason, details, created_at)
  VALUES
    (v_reporter_id, p_reported_id, p_conversation_id, p_reason, v_details, v_now);

  RETURN pg_catalog.jsonb_build_object('status', 'created');
END;
$$;

REVOKE ALL ON FUNCTION public.report_user(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, uuid) TO authenticated;
