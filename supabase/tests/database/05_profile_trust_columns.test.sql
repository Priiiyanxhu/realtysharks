BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(23);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.profiles'::pg_catalog.regclass
      AND tgname = 'profiles_protect_trust_columns'
      AND NOT tgisinternal
  ),
  'profiles_protect_trust_columns trigger exists'
);

SELECT extensions.ok(
  CASE
    WHEN pg_catalog.to_regprocedure('public.protect_profile_trust_columns()') IS NULL
      THEN false
    ELSE NOT pg_catalog.has_function_privilege(
           'authenticated', 'public.protect_profile_trust_columns()', 'EXECUTE')
         AND NOT pg_catalog.has_function_privilege(
           'anon', 'public.protect_profile_trust_columns()', 'EXECUTE')
  END,
  'client roles cannot call the trigger function directly'
);

-- ---------------------------------------------------------------------------
-- Fixtures (handle_new_user creates each profile as the function owner)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000501', 'authenticated', 'authenticated',
   'trust-alice-501@example.invalid', '{}'::jsonb,
   '{"full_name":"Trust Alice"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000502', 'authenticated', 'authenticated',
   'trust-bob-502@example.invalid', '{}'::jsonb,
   '{"full_name":"Trust Bob"}'::jsonb, pg_catalog.now(), pg_catalog.now()),
  ('00000000-0000-4000-8000-000000000503', 'authenticated', 'authenticated',
   'trust-carol-503@example.invalid', '{}'::jsonb,
   '{"full_name":"Trust Carol"}'::jsonb, pg_catalog.now(), pg_catalog.now());

-- Bob was legitimately verified by an admin; Carol has a legacy NULL auth_id.
-- (postgres bypasses the trigger, like the future admin review flow would.)
UPDATE public.profiles
   SET verified = true, kyc_status = 'approved'
 WHERE id = '00000000-0000-4000-8000-000000000502';

UPDATE public.profiles
   SET auth_id = NULL
 WHERE id = '00000000-0000-4000-8000-000000000503';

-- ---------------------------------------------------------------------------
-- Alice (unverified) cannot self-verify
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000501';

SELECT extensions.throws_ok(
  $$UPDATE public.profiles SET verified = true
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  '42501', NULL,
  'a user cannot set their own verified flag'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles SET kyc_status = 'approved'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  '42501', NULL,
  'a user cannot approve their own KYC'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles SET verified = true, kyc_status = 'approved'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  '42501', NULL,
  'a user cannot set verified and kyc_status together'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles
       SET auth_id = '00000000-0000-4000-8000-000000000502'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  '42501', NULL,
  'a user cannot repoint auth_id at another user'
);

-- The exact payload shape the onboarding page upserts.
SELECT extensions.lives_ok(
  $$INSERT INTO public.profiles
      (id, auth_id, full_name, role, agency_name, rera_number, avatar_url,
       onboarded, kyc_status, updated_at)
    VALUES
      ('00000000-0000-4000-8000-000000000501',
       '00000000-0000-4000-8000-000000000501',
       'Alice Onboarded', 'broker', 'Alice Realty', NULL, NULL,
       true, 'pending', pg_catalog.now())
    ON CONFLICT (id) DO UPDATE SET
      auth_id = EXCLUDED.auth_id, full_name = EXCLUDED.full_name,
      role = EXCLUDED.role, agency_name = EXCLUDED.agency_name,
      rera_number = EXCLUDED.rera_number, avatar_url = EXCLUDED.avatar_url,
      onboarded = EXCLUDED.onboarded, kyc_status = EXCLUDED.kyc_status,
      updated_at = EXCLUDED.updated_at$$,
  'onboarding upsert (with kyc_status pending) still works'
);

SELECT extensions.lives_ok(
  $$UPDATE public.profiles
       SET full_name = 'Alice Renamed', agency_name = 'Alice & Co',
           core_expertise = ARRAY['resale'], kyc_status = 'pending'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  'ordinary profile edits (incl. kyc_status pending) still work'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT verified::text || '/' || kyc_status FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000501'),
  'false/pending',
  'Alice is still unverified with kyc_status pending'
);

-- ---------------------------------------------------------------------------
-- Bob (verified) can edit his profile and re-upload KYC, nothing more
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000502';

SELECT extensions.lives_ok(
  $$UPDATE public.profiles SET full_name = 'Bob Renamed', kyc_status = 'approved'
     WHERE id = '00000000-0000-4000-8000-000000000502'$$,
  'editing a profile with unchanged trust columns works'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles SET verified = false
     WHERE id = '00000000-0000-4000-8000-000000000502'$$,
  '42501', NULL,
  'a user cannot change verified in either direction'
);

SELECT extensions.throws_ok(
  $$UPDATE public.profiles SET kyc_status = 'rejected'
     WHERE id = '00000000-0000-4000-8000-000000000502'$$,
  '42501', NULL,
  'a user cannot set kyc_status to anything but pending'
);

SELECT extensions.lives_ok(
  $$UPDATE public.profiles SET kyc_status = 'pending'
     WHERE id = '00000000-0000-4000-8000-000000000502'$$,
  'a KYC re-upload may reset kyc_status to pending'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Carol: NULL auth_id may be filled with her own id, but only that
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000503';

SELECT extensions.throws_ok(
  $$UPDATE public.profiles
       SET auth_id = '00000000-0000-4000-8000-000000000501'
     WHERE id = '00000000-0000-4000-8000-000000000503'$$,
  '42501', NULL,
  'a NULL auth_id cannot be filled with someone else''s id'
);

SELECT extensions.lives_ok(
  $$UPDATE public.profiles
       SET auth_id = '00000000-0000-4000-8000-000000000503'
     WHERE id = '00000000-0000-4000-8000-000000000503'$$,
  'a NULL auth_id can be filled with the user''s own id'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- INSERT path (profile row missing, client creates it)
-- ---------------------------------------------------------------------------
DELETE FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000503';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000503';

SELECT extensions.throws_ok(
  $$INSERT INTO public.profiles (id, auth_id, full_name, verified)
    VALUES ('00000000-0000-4000-8000-000000000503',
            '00000000-0000-4000-8000-000000000503', 'Carol', true)$$,
  '42501', NULL,
  'a user cannot insert their own profile as verified'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.profiles (id, auth_id, full_name, kyc_status)
    VALUES ('00000000-0000-4000-8000-000000000503',
            '00000000-0000-4000-8000-000000000503', 'Carol', 'approved')$$,
  '42501', NULL,
  'a user cannot insert their own profile with approved KYC'
);

SELECT extensions.throws_ok(
  $$INSERT INTO public.profiles (id, auth_id, full_name)
    VALUES ('00000000-0000-4000-8000-000000000503',
            '00000000-0000-4000-8000-000000000501', 'Carol')$$,
  '42501', NULL,
  'a user cannot insert a profile whose auth_id differs from id'
);

SELECT extensions.lives_ok(
  $$INSERT INTO public.profiles (id, full_name)
    VALUES ('00000000-0000-4000-8000-000000000503', 'Carol')$$,
  'a plain self-insert works'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT auth_id::text || '/' || verified::text || '/' || kyc_status
     FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000503'),
  '00000000-0000-4000-8000-000000000503/false/pending',
  'self-insert defaults auth_id to id, unverified, kyc pending'
);

-- ---------------------------------------------------------------------------
-- Trusted contexts keep working (future admin KYC review)
-- ---------------------------------------------------------------------------
SET LOCAL ROLE service_role;

SELECT extensions.lives_ok(
  $$UPDATE public.profiles SET verified = true, kyc_status = 'approved'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  'service_role can verify a profile'
);

RESET ROLE;

SELECT extensions.is(
  (SELECT verified::text || '/' || kyc_status FROM public.profiles
    WHERE id = '00000000-0000-4000-8000-000000000501'),
  'true/approved',
  'service_role verification persisted'
);

SELECT extensions.lives_ok(
  $$UPDATE public.profiles SET verified = false, kyc_status = 'pending'
     WHERE id = '00000000-0000-4000-8000-000000000501'$$,
  'the postgres owner can still change trust columns'
);

SELECT * FROM extensions.finish();

ROLLBACK;
