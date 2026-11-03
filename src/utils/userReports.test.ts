import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  interpretReportResult,
  reportUser,
  validateReport,
} from "./userReports.ts";

describe("REPORT_REASONS stays in sync with the database", () => {
  const migration = fs.readFileSync(
    new URL("../../supabase/migrations/20261103120900_user_reports.sql", import.meta.url),
    "utf8"
  );

  it("every reason the app offers is accepted by the migration's CHECK constraint", () => {
    const check = migration.slice(migration.indexOf("user_reports_reason_check"), migration.indexOf("user_reports_details_length"));
    for (const { value } of REPORT_REASONS) assert.ok(check.includes(`'${value}'`), value);
  });

  it("every reason in the migration's CHECK constraint is offered by the app", () => {
    const check = migration.slice(migration.indexOf("user_reports_reason_check"), migration.indexOf("user_reports_details_length"));
    const inDatabase = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    const inApp = REPORT_REASONS.map((r) => r.value) as string[];
    for (const reason of new Set(inDatabase)) assert.ok(inApp.includes(reason), `database allows "${reason}" but the app does not offer it`);
  });

  it("the function's own reason list matches too", () => {
    const fn = migration.slice(migration.indexOf("p_reason NOT IN ("), migration.indexOf("invalid report reason"));
    for (const { value } of REPORT_REASONS) assert.ok(fn.includes(`'${value}'`), value);
  });

  it("the details limit matches the database's 1000", () => {
    assert.equal(REPORT_DETAILS_MAX, 1000);
    assert.match(migration, /char_length\(details\) <= 1000/);
  });

  it("every reason has a readable label", () => {
    for (const reason of REPORT_REASONS) assert.ok(reason.label.length > 5 && !reason.label.includes("_"));
  });
});

describe("validateReport", () => {
  it("accepts a reason with optional details", () => {
    assert.equal(validateReport("spam", ""), null);
    assert.equal(validateReport("harassment", "  rude messages  "), null);
  });

  it("requires a known reason", () => {
    assert.match(validateReport(null, "") ?? "", /choose a reason/i);
    assert.match(validateReport("because", "") ?? "", /choose a reason/i);
  });

  it("requires details for 'other', ignoring whitespace", () => {
    assert.match(validateReport("other", "   ") ?? "", /tell us what happened/i);
    assert.equal(validateReport("other", "they threatened me"), null);
  });

  it("enforces the length limit on the trimmed text", () => {
    assert.equal(validateReport("spam", "x".repeat(REPORT_DETAILS_MAX)), null);
    assert.equal(validateReport("spam", `  ${"x".repeat(REPORT_DETAILS_MAX)}  `), null);
    assert.match(validateReport("spam", "x".repeat(REPORT_DETAILS_MAX + 1)) ?? "", /under 1000/);
  });
});

describe("interpretReportResult", () => {
  it("created reassures the reporter that the other broker is not told", () => {
    const outcome = interpretReportResult({ status: "created" }, null);
    assert.equal(outcome.kind, "created");
    assert.match(outcome.message, /isn't told/);
  });

  it("duplicate is not an error", () => {
    const outcome = interpretReportResult({ status: "duplicate" }, null);
    assert.equal(outcome.kind, "duplicate");
    assert.match(outcome.message, /already reported/);
  });

  it("rate_limited says how long to wait", () => {
    const outcome = interpretReportResult({ status: "rate_limited", retry_after_seconds: 7200 }, null);
    assert.equal(outcome.kind, "rate_limited");
    assert.match(outcome.message, /about 2 hours/);
  });

  it("rate_limited with a missing or garbage wait still reads sensibly", () => {
    for (const retry of [undefined, null, "soon", Number.NaN]) {
      const outcome = interpretReportResult({ status: "rate_limited", retry_after_seconds: retry }, null);
      assert.equal(outcome.kind, "rate_limited");
      assert.match(outcome.message, /try again later/);
    }
  });

  it("tolerates a one-element array", () => {
    assert.equal(interpretReportResult([{ status: "created" }], null).kind, "created");
  });

  it("an expired session is explained", () => {
    for (const error of [{ code: "28000", message: "x" }, { code: "PGRST301", message: "x" }, { code: "", message: "JWT expired" }]) {
      assert.match(interpretReportResult(null, error).message, /session has expired/i);
    }
  });

  it("anything unexpected is a retryable generic error, never a success", () => {
    const bad: unknown[] = [null, undefined, {}, { status: "weird" }, { status: true }, "created", 1];
    for (const value of bad) assert.equal(interpretReportResult(value, null).kind, "error", JSON.stringify(value));
    assert.equal(interpretReportResult({ status: "created" }, { code: "XX000", message: "boom" }).kind, "error");
  });

  it("never leaks database text", () => {
    const outcomes = [
      interpretReportResult(null, { code: "42883", message: "function public.report_user does not exist" }),
      interpretReportResult(null, { code: "22023", message: "invalid report reason" }),
      interpretReportResult({ status: "nope" }, null),
    ];
    for (const outcome of outcomes) assert.doesNotMatch(outcome.message, /report_user|public\.|42883|22023|invalid report reason|function/i);
  });
});

describe("reportUser", () => {
  const fakeClient = (result: { data?: unknown; error?: { code?: string; message?: string } | null } | "throw") => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        if (result === "throw") throw new Error("network");
        return { data: result.data ?? null, error: result.error ?? null };
      },
    } as unknown as SupabaseClient;
    return { client, calls };
  };

  it("sends trimmed details and the conversation to the RPC", async () => {
    const { client, calls } = fakeClient({ data: { status: "created" } });
    const outcome = await reportUser(client, { reportedId: "u2", reason: "spam", details: "  too many offers  ", conversationId: "c1" });
    assert.equal(outcome.kind, "created");
    assert.deepEqual(calls, [{ fn: "report_user", args: { p_reported_id: "u2", p_reason: "spam", p_details: "too many offers", p_conversation_id: "c1" } }]);
  });

  it("sends NULL (not an empty string) for blank details and a missing conversation", async () => {
    const { client, calls } = fakeClient({ data: { status: "created" } });
    await reportUser(client, { reportedId: "u2", reason: "harassment", details: "   " });
    assert.equal(calls[0].args.p_details, null);
    assert.equal(calls[0].args.p_conversation_id, null);
  });

  it("does not call the database when the form is invalid", async () => {
    const { client, calls } = fakeClient({ data: { status: "created" } });
    const outcome = await reportUser(client, { reportedId: "u2", reason: "other", details: "" });
    assert.equal(outcome.kind, "error");
    assert.equal(calls.length, 0);
  });

  it("turns a network failure into a retryable error instead of throwing", async () => {
    const { client } = fakeClient("throw");
    const outcome = await reportUser(client, { reportedId: "u2", reason: "spam", details: "" });
    assert.equal(outcome.kind, "error");
  });
});
