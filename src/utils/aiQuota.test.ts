import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatWait, interpretQuotaResult } from "./aiQuota.ts";

const allowed = { allowed: true, retry_after_seconds: 0, limit_scope: null };
const denied = (scope: string | null, retry: number) => ({ allowed: false, retry_after_seconds: retry, limit_scope: scope });

describe("interpretQuotaResult: the only way through is an explicit allowed: true", () => {
  it("allows when the database says allowed", () => {
    assert.deepEqual(interpretQuotaResult(allowed, null), { kind: "allowed" });
  });

  it("tolerates the result arriving as a one-element array", () => {
    assert.deepEqual(interpretQuotaResult([allowed], null), { kind: "allowed" });
  });

  it("FAILS CLOSED on a database error (e.g. the migration is not applied)", () => {
    const result = interpretQuotaResult(null, { code: "PGRST202", message: "Could not find the function" });
    assert.equal(result.kind, "unavailable");
    assert.equal((result as { status: number }).status, 503);
  });

  it("FAILS CLOSED when an error accompanies data that looks allowed", () => {
    assert.equal(interpretQuotaResult(allowed, { code: "XX000", message: "boom" }).kind, "unavailable");
  });

  it("FAILS CLOSED on every malformed or ambiguous result", () => {
    const bad: unknown[] = [null, undefined, "allowed", 1, true, [], {}, { allowed: "true" }, { allowed: 1 }, { allowed: null }, { retry_after_seconds: 5 }];
    for (const value of bad) {
      assert.equal(interpretQuotaResult(value, null).kind, "unavailable", JSON.stringify(value));
    }
  });

  it("does not let an extra truthy-looking field turn a denial into an allow", () => {
    const sneaky = { allowed: false, retry_after_seconds: 5, limit_scope: "minute", also_allowed: true };
    assert.equal(interpretQuotaResult(sneaky, null).kind, "limited");
  });
});

describe("interpretQuotaResult: denials", () => {
  it("per-minute limit -> 429 telling the user how long to wait", () => {
    const result = interpretQuotaResult(denied("minute", 12), null);
    assert.equal(result.kind, "limited");
    if (result.kind !== "limited") return;
    assert.equal(result.status, 429);
    assert.equal(result.retryAfterSeconds, 12);
    assert.match(result.message, /too quickly/);
    assert.match(result.message, /12 seconds/);
  });

  it("per-day limit -> 429 with a human wait time", () => {
    const result = interpretQuotaResult(denied("day", 7200), null);
    assert.equal(result.kind, "limited");
    if (result.kind !== "limited") return;
    assert.match(result.message, /today's AI writing limit/);
    assert.match(result.message, /about 2 hours/);
  });

  it("global limit does not blame the user or quote a number", () => {
    const result = interpretQuotaResult(denied("global", 3000), null);
    assert.equal(result.kind, "limited");
    if (result.kind !== "limited") return;
    assert.match(result.message, /very busy/);
    assert.doesNotMatch(result.message, /you've reached|too quickly|\d/i);
    assert.equal(result.retryAfterSeconds, 3000);
  });

  it("an unknown or missing scope still denies, using the per-minute wording", () => {
    for (const scope of [null, "weird", undefined]) {
      assert.equal(interpretQuotaResult(denied(scope as string | null, 9), null).kind, "limited");
    }
  });

  it("sanitises the retry value: fractional rounds up, zero/negative/garbage never reaches 0", () => {
    const retry = (value: unknown) => {
      const r = interpretQuotaResult({ allowed: false, retry_after_seconds: value, limit_scope: "minute" }, null);
      return r.kind === "limited" ? r.retryAfterSeconds : -1;
    };
    assert.equal(retry(4.2), 5);
    assert.equal(retry(0), 1);
    assert.equal(retry(-30), 1);
    assert.equal(retry("soon"), 60);
    assert.equal(retry(null), 60);
    assert.equal(retry(Number.NaN), 60);
  });

  it("never leaks database text, codes or table names to the user", () => {
    const messages = [denied("minute", 5), denied("day", 5), denied("global", 5)].map((d) => {
      const r = interpretQuotaResult(d, null);
      return r.kind === "limited" ? r.message : "";
    });
    messages.push(interpretQuotaResult(null, { code: "42883", message: "function public.consume_ai_quota() does not exist" }).kind === "unavailable"
      ? (interpretQuotaResult(null, { code: "42883", message: "function public.consume_ai_quota() does not exist" }) as { message: string }).message
      : "");
    for (const message of messages) assert.doesNotMatch(message, /consume_ai_quota|public\.|42883|PGRST|rpc|function/i);
  });
});

describe("formatWait", () => {
  it("uses seconds, minutes, then hours, rounding up", () => {
    assert.equal(formatWait(1), "1 second");
    assert.equal(formatWait(45), "45 seconds");
    assert.equal(formatWait(89), "89 seconds");
    assert.equal(formatWait(90), "about 2 minutes");
    assert.equal(formatWait(600), "about 10 minutes");
    assert.equal(formatWait(5340), "about 89 minutes");
    assert.equal(formatWait(5399), "about 2 hours"); // 89.98 min rounds up to 90, which is shown as hours
    assert.equal(formatWait(5400), "about 2 hours");
    assert.equal(formatWait(3600 * 23 + 1), "about 24 hours");
  });

  it("never says zero", () => {
    assert.equal(formatWait(0), "1 second");
    assert.equal(formatWait(0.2), "1 second");
    assert.equal(formatWait(-5), "1 second");
  });
});
