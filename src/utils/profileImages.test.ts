import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAllowedImageExtension,
  removeSupersededProfileImages,
  uploadProfileImage,
} from "./profileImages.ts";

const UID = "00000000-0000-4000-8000-000000000001";

type FakeOptions = {
  uploadError?: { message: string } | null;
  listError?: { name: string } | null;
  removeError?: { name: string } | null;
  throwOnList?: boolean;
};

/** A stateful stand-in for the `avatars` bucket (upsert, list, remove). */
function fakeBucket(initial: string[] = [], options: FakeOptions = {}) {
  const files = new Set(initial.map((name) => `${UID}/${name}`));
  const calls = { uploads: [] as Array<{ path: string; upsert: boolean | undefined }>, removes: [] as string[][] };

  const bucket = {
    upload: async (path: string, _file: unknown, opts?: { upsert?: boolean }) => {
      calls.uploads.push({ path, upsert: opts?.upsert });
      if (options.uploadError) return { error: options.uploadError };
      files.add(path);
      return { error: null };
    },
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `https://abc.supabase.co/storage/v1/object/public/avatars/${path}` },
    }),
    list: async (prefix: string) => {
      if (options.throwOnList) throw new Error("network down");
      if (options.listError) return { data: null, error: options.listError };
      const data = [...files]
        .filter((path) => path.startsWith(`${prefix}/`))
        .map((path) => ({ name: path.slice(prefix.length + 1) }));
      return { data, error: null };
    },
    remove: async (paths: string[]) => {
      calls.removes.push(paths);
      if (options.removeError) return { data: null, error: options.removeError };
      paths.forEach((path) => files.delete(path));
      return { data: paths.map((name) => ({ name })), error: null };
    },
  };

  const client = {
    storage: {
      from: (name: string) => {
        assert.equal(name, "avatars");
        return bucket;
      },
    },
  } as unknown as SupabaseClient;

  const namesInFolder = () =>
    [...files].filter((path) => path.startsWith(`${UID}/`)).map((path) => path.slice(UID.length + 1)).sort();

  return { client, files, calls, namesInFolder };
}

const file = (name: string) => ({ name }) as File;

describe("getAllowedImageExtension", () => {
  it("lower-cases and allow-lists", () => {
    assert.equal(getAllowedImageExtension("Me.PNG"), "png");
    assert.equal(getAllowedImageExtension("a.b.JpEg"), "jpeg");
    assert.equal(getAllowedImageExtension("x.webp"), "webp");
  });

  it("rejects everything else", () => {
    for (const bad of ["noext", "x.", "x.gif", "x.svg", "x.pdf", ".png.exe"]) {
      assert.equal(getAllowedImageExtension(bad), null, bad);
    }
  });
});

describe("uploadProfileImage", () => {
  it("rejects an unsupported type without touching storage", async () => {
    const fake = fakeBucket();
    const result = await uploadProfileImage(fake.client, UID, "avatar", file("x.gif"));
    assert.equal(result.image, null);
    assert.ok(result.error);
    assert.equal(fake.calls.uploads.length, 0);
  });

  it("normalises the extension and returns the path and public URL", async () => {
    const fake = fakeBucket();
    const result = await uploadProfileImage(fake.client, UID, "avatar", file("Photo.JPG"));
    assert.equal(result.error, null);
    assert.equal(result.image?.path, `${UID}/avatar.jpg`);
    assert.match(result.image?.publicUrl ?? "", /avatars\/.*\/avatar\.jpg$/);
    assert.deepEqual(fake.calls.uploads, [{ path: `${UID}/avatar.jpg`, upsert: true }]);
  });

  it("returns storage errors instead of throwing", async () => {
    const fake = fakeBucket([], { uploadError: { message: "denied" } });
    const result = await uploadProfileImage(fake.client, UID, "cover", file("c.png"));
    assert.equal(result.image, null);
    assert.equal(result.error?.message, "denied");
  });
});

describe("removeSupersededProfileImages", () => {
  it("fixes the original bug: avatar.png -> avatar.jpg leaves no PNG behind", async () => {
    const fake = fakeBucket(["avatar.png"]);
    const upload = await uploadProfileImage(fake.client, UID, "avatar", file("new.jpg"));
    assert.deepEqual(fake.namesInFolder(), ["avatar.jpg", "avatar.png"]); // what the old code left behind

    const result = await removeSupersededProfileImages(fake.client, UID, "avatar", upload.image!.path);
    assert.equal(result.removed, 1);
    assert.deepEqual(fake.namesInFolder(), ["avatar.jpg"]);
  });

  it("does nothing (and makes no remove call) for a same-type re-upload", async () => {
    const fake = fakeBucket(["avatar.png"]);
    const upload = await uploadProfileImage(fake.client, UID, "avatar", file("x.png"));
    const result = await removeSupersededProfileImages(fake.client, UID, "avatar", upload.image!.path);
    assert.equal(result.removed, 0);
    assert.equal(fake.calls.removes.length, 0);
  });

  it("removes every stale variant but only files named exactly {kind}.<ext>", async () => {
    const fake = fakeBucket([
      "avatar.png", "avatar.webp", "avatar.PNG", "avatar.jpeg", // stale: removed
      "cover.png", "cover.jpg",                                  // other kind: kept
      "avatar_old.png", "my-avatar.png", "avatar", "avatar.", "avatar.jpg.bak", // look-alikes: kept
      ".emptyFolderPlaceholder", "kyc_document.pdf",             // unrelated: kept
    ]);
    const keep = `${UID}/avatar.jpg`;
    fake.files.add(keep);

    const result = await removeSupersededProfileImages(fake.client, UID, "avatar", keep);
    assert.equal(result.removed, 4);
    assert.deepEqual(fake.namesInFolder(), [
      ".emptyFolderPlaceholder", "avatar", "avatar.", "avatar.jpg", "avatar.jpg.bak",
      "avatar_old.png", "cover.jpg", "cover.png", "kyc_document.pdf", "my-avatar.png",
    ]);
  });

  it("cleaning the cover never touches avatar files", async () => {
    const fake = fakeBucket(["avatar.png", "cover.png", "cover.webp"]);
    await removeSupersededProfileImages(fake.client, UID, "cover", `${UID}/cover.webp`);
    assert.deepEqual(fake.namesInFolder(), ["avatar.png", "cover.webp"]);
  });

  it("only ever deletes inside the given user's folder", async () => {
    const fake = fakeBucket(["avatar.png"]);
    fake.files.add("someone-else/avatar.png");
    await removeSupersededProfileImages(fake.client, UID, "avatar", `${UID}/avatar.jpg`);
    assert.ok(fake.calls.removes.flat().every((path) => path.startsWith(`${UID}/`)));
    assert.ok(fake.files.has("someone-else/avatar.png"));
  });

  it("swallows list errors, remove errors and unexpected exceptions", async () => {
    const cases: FakeOptions[] = [
      { listError: { name: "StorageError" } },
      { removeError: { name: "StorageError" } },
      { throwOnList: true },
    ];
    for (const options of cases) {
      const fake = fakeBucket(["avatar.png"], options);
      const result = await removeSupersededProfileImages(fake.client, UID, "avatar", `${UID}/avatar.jpg`);
      assert.equal(result.removed, 0);
      assert.ok(fake.files.has(`${UID}/avatar.png`), "nothing was deleted on failure");
    }
  });
});
