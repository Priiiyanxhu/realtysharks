import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeStartChatError, describeSendError, describeBlockError } from "./chatErrors.ts";

/**
 * (SQLSTATE, message) pairs exactly as the database raises them. Captured by
 * replaying every migration and provoking each rejection; the strings are the
 * same ones pinned on the database side by
 * supabase/tests/database/09_chat_restrictions.test.sql. If you change a
 * message in the migration, update it there, here, and in chatErrors.ts.
 */
const DB = {
  dailyCap: { code: "54000", message: "daily new conversation limit reached" },
  callerNotOnboarded: { code: "42501", message: "complete onboarding before starting conversations" },
  recipientNotOnboarded: { code: "42501", message: "this user cannot be messaged" },
  blockerToBlocked: { code: "42501", message: "this user cannot be messaged" },
  blockedToBlocker: { code: "42501", message: "this user cannot be messaged" },
  notSignedIn: { code: "28000", message: "authentication required" },
  partnerMissing: { code: "23503", message: "partner profile does not exist" },
  self: { code: "22023", message: "cannot create a direct conversation with yourself" },
  sendBlockedSender: { code: "42501", message: 'new row violates row-level security policy for table "messages"' },
  sendNonParticipant: { code: "42501", message: 'new row violates row-level security policy for table "messages"' },
} as const;

describe("describeStartChatError: real database errors", () => {
  const expected = {
    dailyCap: "daily_limit",
    callerNotOnboarded: "not_onboarded",
    recipientNotOnboarded: "cannot_message",
    blockerToBlocked: "cannot_message",
    blockedToBlocker: "cannot_message",
    notSignedIn: "signed_out",
    partnerMissing: "profile_missing",
    self: "unknown",
  } as const;

  for (const [name, kind] of Object.entries(expected)) {
    it(`${name} -> ${kind}`, () => {
      assert.equal(describeStartChatError(DB[name as keyof typeof expected]).kind, kind);
    });
  }

  it("tells the two 42501 situations apart by message", () => {
    assert.notEqual(
      describeStartChatError(DB.callerNotOnboarded).kind,
      describeStartChatError(DB.recipientNotOnboarded).kind
    );
  });

  it("recognises the daily cap by text even if the SQLSTATE changes", () => {
    assert.equal(
      describeStartChatError({ code: "XX000", message: DB.dailyCap.message }).kind,
      "daily_limit"
    );
  });

  it("explains the cap and what the user can still do", () => {
    const { message } = describeStartChatError(DB.dailyCap);
    assert.match(message, /today's limit/);
    assert.match(message, /existing chats/);
  });
});

describe("privacy: a blocked user can't tell they were blocked", () => {
  it("recipient-not-onboarded, blocked-by-them and blocking-them look identical", () => {
    const a = describeStartChatError(DB.recipientNotOnboarded);
    assert.deepEqual(describeStartChatError(DB.blockerToBlocked), a);
    assert.deepEqual(describeStartChatError(DB.blockedToBlocker), a);
  });

  it("a blocked sender and a non-participant get the same send error", () => {
    assert.deepEqual(describeSendError(DB.sendBlockedSender), describeSendError(DB.sendNonParticipant));
  });

  it("never mentions blocking, onboarding or profiles in the 'cannot message' copy", () => {
    const text = describeStartChatError(DB.recipientNotOnboarded).message.toLowerCase();
    assert.doesNotMatch(text, /block|onboard|profile|set ?up/);
  });

  it("never mentions blocking in the send-rejected copy", () => {
    assert.doesNotMatch(describeSendError(DB.sendBlockedSender).message, /block/i);
  });
});

describe("no database internals reach the user", () => {
  const internals = /row-level|violates|sqlstate|\b(42501|54000|28000|22023|23503)\b|rpc|public\./i;

  it("start and send copy is free of codes, policy wording and schema names", () => {
    const inputs = [...Object.values(DB), { code: "XX000", message: 'relation "x" does not exist' }];
    for (const input of inputs) {
      assert.doesNotMatch(describeStartChatError(input).message, internals);
      assert.doesNotMatch(describeSendError(input).message, internals);
    }
  });
});

describe("fallbacks", () => {
  it("unknown start errors get a retryable generic message", () => {
    for (const input of [null, undefined, {}, { code: "XX000", message: "boom" }, { message: "Failed to fetch" }]) {
      const result = describeStartChatError(input);
      assert.equal(result.kind, "unknown");
      assert.match(result.message, /try again/i);
    }
  });

  it("expired sessions are recognised from code or message", () => {
    for (const input of [DB.notSignedIn, { code: "PGRST301", message: "x" }, { code: "", message: "JWT expired" }]) {
      assert.equal(describeStartChatError(input).kind, "signed_out");
    }
    assert.equal(describeSendError({ code: "PGRST301", message: "JWT expired" }).kind, "signed_out");
  });

  it("unknown send errors get a retryable generic message", () => {
    for (const input of [null, { message: "Failed to fetch" }]) {
      const result = describeSendError(input);
      assert.equal(result.kind, "unknown");
      assert.match(result.message, /try again/i);
    }
  });
});

describe("describeBlockError", () => {
  it("treats blocking someone you already blocked (23505) as success", () => {
    const result = describeBlockError({ code: "23505", message: "duplicate key value violates unique constraint" }, "block");
    assert.equal(result.alreadyDone, true);
  });

  it("does not treat a unique violation as success when unblocking", () => {
    assert.equal(describeBlockError({ code: "23505", message: "x" }, "unblock").alreadyDone, false);
  });

  it("explains a vanished account when blocking (23503)", () => {
    const result = describeBlockError({ code: "23503", message: "violates foreign key constraint" }, "block");
    assert.equal(result.alreadyDone, false);
    assert.match(result.message, /no longer available/);
  });

  it("recognises an expired session for both actions", () => {
    for (const action of ["block", "unblock"] as const) {
      const result = describeBlockError({ code: "PGRST301", message: "JWT expired" }, action);
      assert.match(result.message, /session has expired/i);
    }
  });

  it("falls back to an action-specific retryable message", () => {
    assert.match(describeBlockError({ message: "Failed to fetch" }, "block").message, /couldn't block.*try again/i);
    assert.match(describeBlockError(null, "unblock").message, /couldn't unblock.*try again/i);
  });

  it("never leaks database text or codes", () => {
    for (const action of ["block", "unblock"] as const) {
      const message = describeBlockError({ code: "42501", message: 'new row violates row-level security policy for table "user_blocks"' }, action).message;
      assert.doesNotMatch(message, /row-level|violates|42501|user_blocks|policy/i);
    }
  });
});
