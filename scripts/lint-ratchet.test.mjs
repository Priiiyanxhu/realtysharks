import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compareToBaseline, summarize } from "./lint-ratchet.mjs";

const file = (errorCount, warningCount, fatalErrorCount = 0) => ({ errorCount, warningCount, fatalErrorCount });
const baseline = { errors: 15, warnings: 21 };

describe("summarize", () => {
  it("adds up errors, warnings and fatal errors across files", () => {
    assert.deepEqual(summarize([file(10, 5), file(5, 16), file(0, 0, 1)]), { errors: 15, warnings: 21, fatal: 1 });
  });

  it("treats an empty report as clean", () => {
    assert.deepEqual(summarize([]), { errors: 0, warnings: 0, fatal: 0 });
  });

  it("rejects anything that is not an array", () => {
    assert.throws(() => summarize({}));
    assert.throws(() => summarize(null));
  });
});

describe("compareToBaseline", () => {
  it("passes when counts are unchanged", () => {
    assert.equal(compareToBaseline({ errors: 15, warnings: 21, fatal: 0 }, baseline).ok, true);
  });

  it("fails when errors rise, even if warnings fall", () => {
    const result = compareToBaseline({ errors: 16, warnings: 0, fatal: 0 }, baseline);
    assert.equal(result.ok, false);
    assert.match(result.lines.join("\n"), /errors rose from 15 to 16/);
  });

  it("fails when warnings rise, even if errors fall", () => {
    const result = compareToBaseline({ errors: 0, warnings: 22, fatal: 0 }, baseline);
    assert.equal(result.ok, false);
    assert.match(result.lines.join("\n"), /warnings rose from 21 to 22/);
  });

  it("passes and asks to lower the baseline when counts improve", () => {
    const result = compareToBaseline({ errors: 12, warnings: 21, fatal: 0 }, baseline);
    assert.equal(result.ok, true);
    assert.match(result.lines.join("\n"), /IMPROVED: errors fell from 15 to 12/);
  });

  it("fails on a fatal ESLint error even when counts look fine", () => {
    const result = compareToBaseline({ errors: 0, warnings: 0, fatal: 1 }, baseline);
    assert.equal(result.ok, false);
    assert.match(result.lines.join("\n"), /fatal/);
  });

  it("rejects a malformed baseline instead of silently passing", () => {
    assert.throws(() => compareToBaseline({ errors: 0, warnings: 0, fatal: 0 }, { errors: "15", warnings: 21 }));
    assert.throws(() => compareToBaseline({ errors: 0, warnings: 0, fatal: 0 }, { errors: 15 }));
    assert.throws(() => compareToBaseline({ errors: 0, warnings: 0, fatal: 0 }, { errors: -1, warnings: 21 }));
  });
});

describe("committed baseline file", () => {
  it("is valid and has non-negative integer counts", () => {
    const parsed = JSON.parse(fs.readFileSync(new URL("../.github/lint-baseline.json", import.meta.url), "utf8"));
    for (const kind of ["errors", "warnings"]) {
      assert.ok(Number.isInteger(parsed[kind]) && parsed[kind] >= 0, kind);
    }
  });
});
