-- ============================================================================
-- 20261103120700_orphaned_avatar_detection.sql
--
-- Problem: the app uploads to {uid}/avatar.<ext> and {uid}/cover.<ext> with
-- upsert. Changing from avatar.png to avatar.jpg leaves the old PNG behind
-- forever (a different object name, so upsert doesn't replace it). Over time
-- the avatars bucket fills with superseded files that are still fetchable by
-- URL, still billed, and (for deleted users) have no owner at all.
--
-- WHY THIS MIGRATION DOES NOT DELETE ANYTHING
-- Do NOT clean the bucket with `DELETE FROM storage.objects`. That removes only
-- the metadata row; the file in the underlying object store is left behind,
-- still billed and now impossible to find. Supabase blocks such deletes unless
-- a bypass flag is set (see the note in tests/database/04_storage_security).
-- Files must be removed through the Storage API. So this migration only adds
-- the DETECTION half; scripts/cleanup-orphaned-avatars.mjs performs deletion
-- through the Storage API using what this function returns.
--
-- public.list_orphaned_avatar_objects(p_min_age) returns avatars-bucket objects
-- that are safe-to-consider for removal:
--   * 'owner profile does not exist'  - folder is not an existing profile id
--   * 'not referenced by profile avatar_url or cover_url'
-- An object is REFERENCED (never listed) when the owner's avatar_url or
-- cover_url, ignoring any ?query string, ends with '/' || the object name. Suffix
-- matching keeps this independent of the project host or URL form.
--
-- Safety properties:
--   * p_min_age (default 24h) protects in-flight uploads: the file is written
--     before the profile row is updated, so a fresh object is briefly
--     unreferenced. Age is measured from the object's last write.
--   * Objects outside the avatars bucket are never returned.
--   * Dashboard folder placeholders are never returned.
--   * Every row also carries bucket_object_count (the bucket's total), so a
--     caller can refuse to act when "orphans" is an implausibly large share of
--     the bucket - the symptom of profile URLs changing format, which would
--     otherwise make live avatars look orphaned.
--   * SECURITY INVOKER and service_role-only: it reads storage.objects and all
--     profiles, so it must never be callable by anon or authenticated users.
--
-- ADDITIVE; changes no table, policy or object. Idempotent / rerun-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_orphaned_avatar_objects(
  p_min_age interval DEFAULT interval '24 hours'
)
RETURNS TABLE (
  object_id uuid,
  name text,
  last_written_at timestamptz,
  reason text,
  bucket_object_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH avatar_objects AS (
    SELECT
      o.id,
      o.name,
      COALESCE(o.updated_at, o.created_at) AS last_written_at,
      (storage.foldername(o.name))[1] AS folder,
      pg_catalog.count(*) OVER () AS bucket_object_count
    FROM storage.objects AS o
    WHERE o.bucket_id = 'avatars'
  )
  SELECT
    a.id,
    a.name,
    a.last_written_at,
    CASE
      WHEN p.id IS NULL THEN 'owner profile does not exist'
      ELSE 'not referenced by profile avatar_url or cover_url'
    END,
    a.bucket_object_count
  FROM avatar_objects AS a
  LEFT JOIN public.profiles AS p
    ON p.id::text = a.folder
  WHERE a.last_written_at < pg_catalog.now() - p_min_age
    AND a.name NOT LIKE '%.emptyFolderPlaceholder'
    AND (
      p.id IS NULL
      OR (
        pg_catalog.right(
          pg_catalog.split_part(COALESCE(p.avatar_url, ''), '?', 1),
          pg_catalog.length(a.name) + 1
        ) IS DISTINCT FROM '/' || a.name
        AND pg_catalog.right(
          pg_catalog.split_part(COALESCE(p.cover_url, ''), '?', 1),
          pg_catalog.length(a.name) + 1
        ) IS DISTINCT FROM '/' || a.name
      )
    )
  ORDER BY a.last_written_at, a.name;
$$;

REVOKE ALL ON FUNCTION public.list_orphaned_avatar_objects(interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphaned_avatar_objects(interval)
  TO service_role;
