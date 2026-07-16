-- ============================================================================
-- 20260716165127_converge_production_security.sql
--
-- Forward-only convergence for the manually evolved production schema and a
-- fully replayed local database. Restores auth signup profile creation,
-- canonicalizes listing ownership/security, and narrows client table grants.
-- Existing profile business data and listing rows are not rewritten.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Restore idempotent auth signup profile creation without overwriting any
--    existing non-null profile identity or business data.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, auth_id, full_name)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name'
  )
  ON CONFLICT (id) DO UPDATE
    SET auth_id = COALESCE(public.profiles.auth_id, EXCLUDED.auth_id),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Reconcile the production listing visibility field used by the final RLS
--    policy. The default protects future frontend writes that do not currently
--    send privacy_level; existing rows are intentionally not backfilled.
-- ----------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS privacy_level text;

ALTER TABLE public.listings
  ALTER COLUMN privacy_level SET DEFAULT 'public';

-- ----------------------------------------------------------------------------
-- 3. Ensure the canonical listings(broker_id) -> profiles(id) FK with cascade.
--    Abort before constraint changes if any listing has no matching profile.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  canonical_constraint_oid oid;
  equivalent_constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.listings AS listing
    LEFT JOIN public.profiles AS profile
      ON profile.id = listing.broker_id
    WHERE profile.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot converge listings_broker_id_fkey: orphan listings.broker_id values exist'
      USING ERRCODE = '23503';
  END IF;

  SELECT constraint_row.oid
    INTO canonical_constraint_oid
    FROM pg_catalog.pg_constraint AS constraint_row
   WHERE constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
     AND constraint_row.conname = 'listings_broker_id_fkey';

  IF canonical_constraint_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_attribute AS source_attribute
      ON source_attribute.attrelid = constraint_row.conrelid
     AND source_attribute.attnum = constraint_row.conkey[1]
     AND NOT source_attribute.attisdropped
    JOIN pg_catalog.pg_attribute AS target_attribute
      ON target_attribute.attrelid = constraint_row.confrelid
     AND target_attribute.attnum = constraint_row.confkey[1]
     AND NOT target_attribute.attisdropped
    WHERE constraint_row.oid = canonical_constraint_oid
      AND constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
      AND constraint_row.confrelid = 'public.profiles'::pg_catalog.regclass
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
      AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
      AND source_attribute.attname = 'broker_id'
      AND target_attribute.attname = 'id'
      AND constraint_row.confdeltype = 'c'
  ) THEN
    ALTER TABLE public.listings
      DROP CONSTRAINT listings_broker_id_fkey;
    canonical_constraint_oid := NULL;
  END IF;

  IF canonical_constraint_oid IS NULL THEN
    SELECT constraint_row.conname
      INTO equivalent_constraint_name
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN pg_catalog.pg_attribute AS source_attribute
        ON source_attribute.attrelid = constraint_row.conrelid
       AND source_attribute.attnum = constraint_row.conkey[1]
       AND NOT source_attribute.attisdropped
      JOIN pg_catalog.pg_attribute AS target_attribute
        ON target_attribute.attrelid = constraint_row.confrelid
       AND target_attribute.attnum = constraint_row.confkey[1]
       AND NOT target_attribute.attisdropped
     WHERE constraint_row.contype = 'f'
       AND constraint_row.conrelid = 'public.listings'::pg_catalog.regclass
       AND constraint_row.confrelid = 'public.profiles'::pg_catalog.regclass
       AND pg_catalog.array_length(constraint_row.conkey, 1) = 1
       AND pg_catalog.array_length(constraint_row.confkey, 1) = 1
       AND source_attribute.attname = 'broker_id'
       AND target_attribute.attname = 'id'
       AND constraint_row.confdeltype = 'c'
     ORDER BY constraint_row.oid
     LIMIT 1;

    IF equivalent_constraint_name IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'ALTER TABLE public.listings RENAME CONSTRAINT %I TO listings_broker_id_fkey',
        equivalent_constraint_name
      );
    ELSE
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_broker_id_fkey
        FOREIGN KEY (broker_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Remove every current listing policy by catalog identity, including
--    policies created manually or under unexpected names. Then create one
--    canonical policy for each application operation. No anonymous listing
--    policy is created.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_listings_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY IF EXISTS %I ON public.listings',
      policy_record.policyname
    );
  END LOOP;

  EXECUTE $policy$
    CREATE POLICY listings_select_authenticated
      ON public.listings FOR SELECT
      TO authenticated
      USING (
        broker_id = auth.uid()
        OR (
          is_active = true
          AND COALESCE(privacy_level, 'public') = 'public'
        )
      )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY listings_insert_own
      ON public.listings FOR INSERT
      TO authenticated
      WITH CHECK (broker_id = auth.uid())
  $policy$;

  EXECUTE $policy$
    CREATE POLICY listings_update_own
      ON public.listings FOR UPDATE
      TO authenticated
      USING (broker_id = auth.uid())
      WITH CHECK (broker_id = auth.uid())
  $policy$;

  EXECUTE $policy$
    CREATE POLICY listings_delete_own
      ON public.listings FOR DELETE
      TO authenticated
      USING (broker_id = auth.uid())
  $policy$;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_listings_policies()
  FROM PUBLIC, anon, authenticated;

SELECT public.normalize_listings_policies();

-- ----------------------------------------------------------------------------
-- 5. Replace inherited/default client grants with the exact operations needed
--    by the RLS-protected frontend and SECURITY DEFINER chat RPC design.
--    service_role privileges are intentionally untouched.
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.listings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.listings TO authenticated;

REVOKE ALL ON TABLE public.conversations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.conversations TO authenticated;

REVOKE ALL ON TABLE public.conversation_participants
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.conversation_participants TO authenticated;

REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.messages TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Harden the existing read-receipt SECURITY DEFINER function without
--    changing its body. Fail with a precise dependency error if production is
--    missing the exact function expected by the deployed frontend.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
    'public.mark_conversation_messages_read(uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Cannot harden read receipts: public.mark_conversation_messages_read(uuid) is missing'
      USING ERRCODE = '42883';
  END IF;

  ALTER FUNCTION public.mark_conversation_messages_read(uuid)
    SET search_path = '';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_messages_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_messages_read(uuid)
  TO authenticated;
