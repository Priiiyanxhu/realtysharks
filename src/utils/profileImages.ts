import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Profile avatar / cover uploads.
 *
 * Files live in the public `avatars` bucket at `{userId}/avatar.<ext>` and
 * `{userId}/cover.<ext>`. Uploading with `upsert` only replaces a file with the
 * SAME name, so switching e.g. avatar.png -> avatar.jpg used to leave the old
 * PNG behind forever (still fetchable by URL, still billed).
 *
 * Usage is deliberately two-step:
 *   1. uploadProfileImage()                 - upload and get the public URL
 *   2. save the URL on the profile row
 *   3. removeSupersededProfileImages()      - only now delete the older files
 *
 * Deleting before the profile row is saved would leave the profile pointing at
 * a file that no longer exists if that save failed.
 */

const BUCKET = "avatars";
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export type ProfileImageKind = "avatar" | "cover";

export type UploadedProfileImage = {
  kind: ProfileImageKind;
  /** Storage path inside the bucket, e.g. `{userId}/avatar.jpg`. */
  path: string;
  publicUrl: string;
};

export type UploadProfileImageResult =
  | { image: UploadedProfileImage; error: null }
  | { image: null; error: Error };

/** Lower-cased extension if it is one the storage policies allow, else null. */
export function getAllowedImageExtension(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return null;
  const ext = fileName.slice(dot + 1).toLowerCase();
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

export async function uploadProfileImage(
  client: SupabaseClient,
  userId: string,
  kind: ProfileImageKind,
  file: File
): Promise<UploadProfileImageResult> {
  const ext = getAllowedImageExtension(file.name);
  if (!ext) {
    return { image: null, error: new Error("Unsupported image type. Please use a JPG, PNG or WebP file.") };
  }

  const path = `${userId}/${kind}.${ext}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) return { image: null, error: new Error(error.message) };

  const {
    data: { publicUrl },
  } = client.storage.from(BUCKET).getPublicUrl(path);

  return { image: { kind, path, publicUrl }, error: null };
}

/**
 * Deletes the user's OTHER files of the same kind (avatar.* or cover.*), keeping
 * `keepPath`. Call only after the profile row referencing `keepPath` is saved.
 *
 * Best effort: never throws, because a cleanup hiccup must not fail a profile
 * save that already succeeded. Anything missed is swept up later by
 * scripts/cleanup-orphaned-avatars.mjs.
 *
 * Only files named exactly `{kind}.<alphanumeric extension>` are eligible, so
 * nothing else in the user's folder can be deleted by this function.
 */
export async function removeSupersededProfileImages(
  client: SupabaseClient,
  userId: string,
  kind: ProfileImageKind,
  keepPath: string
): Promise<{ removed: number }> {
  try {
    const bucket = client.storage.from(BUCKET);
    const { data: files, error: listError } = await bucket.list(userId, { limit: 100 });
    if (listError || !files) {
      console.warn("Could not list previous profile images.", { code: listError?.name });
      return { removed: 0 };
    }

    const eligible = new RegExp(`^${kind}\\.[A-Za-z0-9]+$`);
    const stale = files
      .map((file) => file.name)
      .filter((name) => eligible.test(name) && `${userId}/${name}` !== keepPath)
      .map((name) => `${userId}/${name}`);

    if (stale.length === 0) return { removed: 0 };

    const { data: removed, error: removeError } = await bucket.remove(stale);
    if (removeError) {
      console.warn("Could not remove previous profile images.", { code: removeError.name });
      return { removed: 0 };
    }
    return { removed: removed?.length ?? 0 };
  } catch {
    console.warn("Unexpected error while removing previous profile images.");
    return { removed: 0 };
  }
}
