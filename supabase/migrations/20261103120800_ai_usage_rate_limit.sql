-- ============================================================================
-- 20261103120800_ai_usage_rate_limit.sql
--
-- Problem: POST /api/ai-autowrite calls Gemini (paid) with a client-controlled
-- prompt and had no limit. Any logged-in user could loop it and run up spend.
--
-- Fix: public.consume_ai_quota() - an atomic "check the limits, and if they
-- allow it, record one use" RPC that the route calls before it calls Gemini.
--
-- Why Postgres and not in-memory: the route runs on serverless instances that
-- are many, short-lived and unshared, so a per-process counter neither
-- survives a cold start nor sees other instances. The database is the shared,
-- durable store the app already has.
--
-- Limits (constants inside the function; change one line and re-run
-- CREATE OR REPLACE to tune them):
--   * 5 uses per rolling minute per user      (stops loops and double-submits)
--   * 50 uses per rolling 24 hours per user   (bounds a day's spend per account)
--   * 2000 uses per rolling 24 hours, ALL users (global circuit breaker)
-- The global limit exists because signup is open: a per-user limit alone can be
-- sidestepped by registering more accounts. It caps worst-case daily spend no
-- matter how many accounts exist. It is a soft cap (two calls racing at the
-- boundary can overshoot by a few); the per-user limits are exact.
--
-- Behaviour:
--   * Identity is auth.uid(); there is no user parameter to forge. Calling it
--     without a session raises 28000.
--   * Returns jsonb {allowed, retry_after_seconds, limit_scope}; limit_scope is
--     'minute', 'day' or 'global' when denied, NULL when allowed. Denials are
--     NOT recorded, so a blocked caller cannot grow the table or extend their
--     own lockout by retrying.
--   * A per-user advisory lock makes check + insert atomic: concurrent calls
--     from one user cannot slip past the limit together.
--   * Housekeeping: each call deletes up to 200 expired rows (older than the
--     24h window), skipping locked rows, so the table stays small without a
--     scheduled job.
--
-- Access: the table has RLS enabled with NO policies and no client grants, so
-- clients can only reach it through this function. The function is executable
-- by authenticated users only.
--
-- ROLLOUT ORDER: apply this migration BEFORE deploying the route that calls it.
-- The route fails CLOSED (503) if the function is missing, so deploying the
-- code first turns AI writing off until the migration is applied.
--
-- NON-DESTRUCTIVE (adds a table and a function). Idempotent / rerun-safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx
  ON public.ai_usage_events (created_at);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: no client role may read or write this table.

REVOKE ALL ON TABLE public.ai_usage_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_burst_limit        constant integer  := 5;
  c_burst_window       constant interval := interval '1 minute';
  c_daily_limit        constant integer  := 50;
  c_daily_window       constant interval := interval '24 hours';
  c_global_daily_limit constant integer  := 2000;
  c_cleanup_batch      constant integer  := 200;

  v_user_id uuid := auth.uid();
  -- clock_timestamp(), not now(): now() is frozen at transaction start, which
  -- may be before this call finished waiting on the advisory lock.
  v_now     timestamptz := pg_catalog.clock_timestamp();
  v_count   integer;
  v_frees_at timestamptz;
  -- (GREATEST is part of the SQL grammar, not a function, so it cannot and need not be
  -- schema-qualified like the pg_catalog.* calls below.)
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '28000';
  END IF;

  -- Serialize this user's calls so check + insert is atomic.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('realtysharks:ai-quota:' || v_user_id::text, 0)
  );

  -- Housekeeping: drop expired rows (any user), a bounded batch per call.
  DELETE FROM public.ai_usage_events
   WHERE ctid IN (
     SELECT e.ctid
       FROM public.ai_usage_events AS e
      WHERE e.created_at <= v_now - c_daily_window
      LIMIT c_cleanup_batch
        FOR UPDATE SKIP LOCKED
   );

  -- ---- per-user, per-minute ------------------------------------------------
  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.ai_usage_events
   WHERE user_id = v_user_id
     AND created_at > v_now - c_burst_window;

  IF v_count >= c_burst_limit THEN
    -- A slot frees when the (count - limit + 1)-th oldest use leaves the window.
    SELECT e.created_at + c_burst_window
      INTO v_frees_at
      FROM public.ai_usage_events AS e
     WHERE e.user_id = v_user_id
       AND e.created_at > v_now - c_burst_window
     ORDER BY e.created_at ASC
    OFFSET (v_count - c_burst_limit) LIMIT 1;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'retry_after_seconds',
        GREATEST(1, pg_catalog.ceil(
          pg_catalog.date_part('epoch', v_frees_at - v_now))::integer),
      'limit_scope', 'minute'
    );
  END IF;

  -- ---- per-user, per-day ---------------------------------------------------
  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.ai_usage_events
   WHERE user_id = v_user_id
     AND created_at > v_now - c_daily_window;

  IF v_count >= c_daily_limit THEN
    SELECT e.created_at + c_daily_window
      INTO v_frees_at
      FROM public.ai_usage_events AS e
     WHERE e.user_id = v_user_id
       AND e.created_at > v_now - c_daily_window
     ORDER BY e.created_at ASC
    OFFSET (v_count - c_daily_limit) LIMIT 1;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'retry_after_seconds',
        GREATEST(1, pg_catalog.ceil(
          pg_catalog.date_part('epoch', v_frees_at - v_now))::integer),
      'limit_scope', 'day'
    );
  END IF;

  -- ---- global circuit breaker ---------------------------------------------
  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.ai_usage_events
   WHERE created_at > v_now - c_daily_window;

  IF v_count >= c_global_daily_limit THEN
    SELECT e.created_at + c_daily_window
      INTO v_frees_at
      FROM public.ai_usage_events AS e
     WHERE e.created_at > v_now - c_daily_window
     ORDER BY e.created_at ASC
    OFFSET (v_count - c_global_daily_limit) LIMIT 1;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'retry_after_seconds',
        GREATEST(1, pg_catalog.ceil(
          pg_catalog.date_part('epoch', v_frees_at - v_now))::integer),
      'limit_scope', 'global'
    );
  END IF;

  INSERT INTO public.ai_usage_events (user_id, created_at)
  VALUES (v_user_id, v_now);

  RETURN pg_catalog.jsonb_build_object(
    'allowed', true,
    'retry_after_seconds', 0,
    'limit_scope', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;
