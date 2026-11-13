import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanupOrphanedAvatars, parseArgs } from "./cleanup-orphaned-avatars.mjs";

// The SQL that decides what is an orphan is covered by
// supabase/tests/database/10_orphaned_avatar_detection.test.sql. These tests
// cover the script around it: dry run, batching, and the mass-deletion guard.

const quiet = () => {};
const rows = (count, bucketTotal) =>
  Array.from({ length: count }, (_, i) => ({ name: `u/f${i}.png`, reason: "r", bucket_object_count: bucketTotal }));
const options = (overrides = {}) => ({ ...parseArgs([]), ...overrides });

function mockClient({ data, rpcError = null, removeError = null }) {
  const calls = { rpc: [], remove: [] };
  const client = {
    rpc: async (fn, args) => {
      calls.rpc.push([fn, args]);
      return { data, error: rpcError };
    },
    storage: {
      from: (bucket) => ({
        remove: async (names) => {
          calls.remove.push([bucket, names.length]);
          return removeError
            ? { data: null, error: removeError }
            : { data: names.map((name) => ({ name })), error: null };
        },
      }),
    },
  };
  return { client, calls };
}

const run = (mock, opts) => cleanupOrphanedAvatars({ client: mock.client, options: opts, log: quiet });

describe("cleanupOrphanedAvatars", () => {
  it("does nothing when there are no orphans", async () => {
    const mock = mockClient({ data: [] });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.status, "ok");
    assert.equal(mock.calls.remove.length, 0);
  });

  it("passes the minimum age to the SQL function", async () => {
    const mock = mockClient({ data: [] });
    await run(mock, options({ minAgeHours: 48 }));
    assert.deepEqual(mock.calls.rpc[0], ["list_orphaned_avatar_objects", { p_min_age: "48 hours" }]);
  });

  it("is a dry run by default and never calls remove", async () => {
    const mock = mockClient({ data: rows(5, 100) });
    const result = await run(mock, options());
    assert.equal(result.deleted, 0);
    assert.equal(mock.calls.remove.length, 0);
  });

  it("with --delete removes from the avatars bucket in batches of 100", async () => {
    const mock = mockClient({ data: rows(250, 5000) });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.deleted, 250);
    assert.deepEqual(mock.calls.remove, [["avatars", 100], ["avatars", 100], ["avatars", 50]]);
  });

  it("--limit caps how many files one run touches", async () => {
    const mock = mockClient({ data: rows(250, 5000) });
    const result = await run(mock, options({ delete: true, limit: 120 }));
    assert.equal(result.deleted, 120);
  });

  it("refuses when orphans are an implausible share of the bucket", async () => {
    const mock = mockClient({ data: rows(40, 100) });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.status, "refused");
    assert.equal(mock.calls.remove.length, 0);
  });

  it("refuses even when every file in a large bucket looks orphaned", async () => {
    const mock = mockClient({ data: rows(500, 500) });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.status, "refused");
    assert.equal(mock.calls.remove.length, 0);
  });

  it("always allows small runs, even 100% of a tiny bucket", async () => {
    const mock = mockClient({ data: rows(5, 5) });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.status, "ok");
    assert.equal(result.deleted, 5);
  });

  it("lets an explicit --max-orphan-ratio allow a larger share", async () => {
    const mock = mockClient({ data: rows(40, 100) });
    const result = await run(mock, options({ delete: true, maxOrphanRatio: 0.5 }));
    assert.equal(result.status, "ok");
    assert.equal(result.deleted, 40);
  });

  it("reports a partial failure and counts nothing as deleted when storage errors", async () => {
    const mock = mockClient({ data: rows(5, 100), removeError: { message: "boom" } });
    const result = await run(mock, options({ delete: true }));
    assert.equal(result.status, "partial-failure");
    assert.equal(result.failed, 5);
    assert.equal(result.deleted, 0);
  });

  it("throws when the SQL function errors", async () => {
    const mock = mockClient({ data: null, rpcError: { message: "permission denied" } });
    await assert.rejects(() => run(mock, options()), /permission denied/);
  });
});

describe("parseArgs", () => {
  it("defaults to a safe dry run", () => {
    assert.deepEqual(parseArgs([]), { delete: false, minAgeHours: 24, limit: 500, maxOrphanRatio: 0.3 });
  });

  it("reads each flag", () => {
    assert.deepEqual(
      parseArgs(["--delete", "--min-age-hours", "48", "--limit", "10", "--max-orphan-ratio", "0.5"]),
      { delete: true, minAgeHours: 48, limit: 10, maxOrphanRatio: 0.5 }
    );
  });

  it("rejects unknown flags and bad values", () => {
    assert.throws(() => parseArgs(["--nuke"]));
    assert.throws(() => parseArgs(["--limit", "abc"]));
    assert.throws(() => parseArgs(["--limit", "0"]));
    assert.throws(() => parseArgs(["--min-age-hours", "-1"]));
  });
});
