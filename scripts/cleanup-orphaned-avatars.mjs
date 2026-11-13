#!/usr/bin/env node
/**
 * Removes orphaned files from the `avatars` Storage bucket.
 *
 * Orphans are found by public.list_orphaned_avatar_objects() (see
 * supabase/migrations/20261103120700_orphaned_avatar_detection.sql) and removed
 * through the Storage API - never with SQL DELETE, which would leave the real
 * files behind in the object store.
 *
 * DRY RUN BY DEFAULT: nothing is deleted unless you pass --delete.
 *
 * SERVER-SIDE / OPERATOR USE ONLY. This needs the service_role key, which
 * bypasses RLS. Run it from a trusted machine or CI secret store. Never bundle
 * it into the app or expose the key to the browser. The key is read from the
 * environment and never printed.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/cleanup-orphaned-avatars.mjs                 # report only
 *   node scripts/cleanup-orphaned-avatars.mjs --delete        # actually delete
 *
 * Options:
 *   --delete                 perform deletion (default is a dry run)
 *   --min-age-hours <n>      only consider files unwritten for n hours (default 24)
 *   --limit <n>              max files to act on per run (default 500)
 *   --max-orphan-ratio <r>   refuse if orphans exceed this share of the bucket
 *                            (default 0.3). Guards against profile URLs having
 *                            changed format, which would make LIVE avatars look
 *                            orphaned. Small counts (<= 10) are always allowed.
 */
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "avatars";
const REMOVE_BATCH_SIZE = 100;
const SMALL_RUN_ALWAYS_OK = 10;

export function parseArgs(argv) {
  const options = { delete: false, minAgeHours: 24, limit: 500, maxOrphanRatio: 0.3 };
  const numberArg = (name, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${name} needs a non-negative number, got "${value}"`);
    }
    return parsed;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--delete") options.delete = true;
    else if (arg === "--min-age-hours") options.minAgeHours = numberArg(arg, argv[++i]);
    else if (arg === "--limit") options.limit = numberArg(arg, argv[++i]);
    else if (arg === "--max-orphan-ratio") options.maxOrphanRatio = numberArg(arg, argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.limit < 1) throw new Error("--limit must be at least 1");
  return options;
}

/**
 * @returns {Promise<{status: "ok"|"refused"|"partial-failure", found: number,
 *                    deleted: number, failed: number}>}
 */
export async function cleanupOrphanedAvatars({ client, options, log = console.log }) {
  const { data, error } = await client.rpc("list_orphaned_avatar_objects", {
    p_min_age: `${options.minAgeHours} hours`,
  });
  if (error) throw new Error(`list_orphaned_avatar_objects failed: ${error.message}`);

  const orphans = data ?? [];
  if (orphans.length === 0) {
    log("No orphaned avatar files found.");
    return { status: "ok", found: 0, deleted: 0, failed: 0 };
  }

  const bucketTotal = Number(orphans[0].bucket_object_count) || 0;
  const allowed = Math.max(SMALL_RUN_ALWAYS_OK, Math.floor(bucketTotal * options.maxOrphanRatio));
  log(`Found ${orphans.length} orphaned file(s) in a bucket of ${bucketTotal}.`);

  if (orphans.length > allowed) {
    log(
      `REFUSING: ${orphans.length} orphans exceeds the safety limit of ${allowed} ` +
        `(${options.maxOrphanRatio * 100}% of the bucket). This usually means profile ` +
        "avatar_url/cover_url values stopped matching file paths, so live avatars would " +
        "be deleted. Inspect list_orphaned_avatar_objects() manually; only raise " +
        "--max-orphan-ratio if you have confirmed the list is genuinely orphaned.",
    );
    return { status: "refused", found: orphans.length, deleted: 0, failed: 0 };
  }

  const targets = orphans.slice(0, options.limit);
  if (targets.length < orphans.length) {
    log(`Limiting this run to ${targets.length} (--limit); re-run to continue.`);
  }

  if (!options.delete) {
    log("DRY RUN - nothing deleted. Re-run with --delete to remove these:");
    targets.slice(0, 50).forEach((row) => log(`  ${row.name}  [${row.reason}]`));
    if (targets.length > 50) log(`  ...and ${targets.length - 50} more`);
    return { status: "ok", found: orphans.length, deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += REMOVE_BATCH_SIZE) {
    const batch = targets.slice(i, i + REMOVE_BATCH_SIZE).map((row) => row.name);
    const { data: removed, error: removeError } = await client.storage.from(BUCKET).remove(batch);
    if (removeError) {
      failed += batch.length;
      log(`Batch of ${batch.length} failed: ${removeError.message}`);
    } else {
      deleted += removed?.length ?? 0;
    }
  }

  log(`Deleted ${deleted} file(s); ${failed} failed.`);
  return { status: failed > 0 ? "partial-failure" : "ok", found: orphans.length, deleted, failed };
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(64);
  }

  const options = parseArgs(process.argv.slice(2));
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await cleanupOrphanedAvatars({ client, options });
  process.exit(result.status === "ok" ? 0 : result.status === "refused" ? 2 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
