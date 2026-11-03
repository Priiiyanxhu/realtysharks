import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeClearError, filterClearedMessages, isVisibleAfterClear } from "./conversationClear.ts";

const at = (iso: string, id = "m") => ({ id, created_at: iso });
const CLEARED = "2026-11-03T10:00:00.000Z";

describe("isVisibleAfterClear", () => {
  it("shows everything when nothing was cleared", () => {
    for (const marker of [null, undefined, ""]) assert.equal(isVisibleAfterClear(at("2020-01-01T00:00:00Z"), marker), true);
  });

  it("hides messages at or before the marker, shows later ones", () => {
    assert.equal(isVisibleAfterClear(at("2026-11-03T09:59:59.999Z"), CLEARED), false);
    assert.equal(isVisibleAfterClear(at(CLEARED), CLEARED), false);
    assert.equal(isVisibleAfterClear(at("2026-11-03T10:00:00.001Z"), CLEARED), true);
  });

  it("compares instants, not strings (different offsets / precision)", () => {
    assert.equal(isVisibleAfterClear(at("2026-11-03T15:30:01+05:30"), "2026-11-03T10:00:00Z"), true);
    assert.equal(isVisibleAfterClear(at("2026-11-03T15:29:59+05:30"), "2026-11-03T10:00:00Z"), false);
    assert.equal(isVisibleAfterClear(at("2026-11-03T10:00:00.5Z"), "2026-11-03T10:00:00.123456Z"), true);
  });

  it("keeps the user's own just-sent optimistic message even if their clock is behind", () => {
    assert.equal(isVisibleAfterClear({ id: "temp-123", created_at: "2026-11-03T09:00:00Z" }, CLEARED), true);
  });

  it("FAILS OPEN: an unparsable marker or timestamp never hides a message", () => {
    assert.equal(isVisibleAfterClear(at("2026-11-03T09:00:00Z"), "not a date"), true);
    assert.equal(isVisibleAfterClear(at("garbage"), CLEARED), true);
  });
});

describe("filterClearedMessages", () => {
  const messages = [at("2026-11-03T08:00:00Z", "a"), at("2026-11-03T09:59:00Z", "b"), at("2026-11-03T10:05:00Z", "c"), at("2026-11-03T11:00:00Z", "d")];

  it("returns only the messages after the marker, in order", () => {
    assert.deepEqual(filterClearedMessages(messages, CLEARED).map((m) => m.id), ["c", "d"]);
  });

  it("returns the same list when nothing was cleared (no copy, no work)", () => {
    assert.equal(filterClearedMessages(messages, null), messages);
  });

  it("returns an empty list when everything predates the marker, and does not mutate the input", () => {
    const copy = [...messages];
    assert.deepEqual(filterClearedMessages(messages, "2030-01-01T00:00:00Z"), []);
    assert.deepEqual(messages, copy);
  });

  it("a message arriving after the clear is shown", () => {
    const withNew = [...messages, at("2026-11-03T12:00:00Z", "new")];
    assert.ok(filterClearedMessages(withNew, CLEARED).some((m) => m.id === "new"));
  });
});

describe("describeClearError", () => {
  it("explains an expired session", () => {
    for (const error of [{ code: "28000" }, { code: "PGRST301" }, { message: "JWT expired" }]) {
      assert.match(describeClearError(error), /session has expired/i);
    }
  });

  it("otherwise gives a retryable message with no database text", () => {
    for (const error of [null, undefined, { code: "42501", message: "not a participant of this conversation" }, { code: "PGRST202", message: "Could not find the function public.clear_conversation_history" }]) {
      const message = describeClearError(error);
      assert.match(message, /couldn't clear this chat.*try again/i);
      assert.doesNotMatch(message, /participant|public\.|PGRST|42501|function/i);
    }
  });
});
