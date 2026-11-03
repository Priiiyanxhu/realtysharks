#!/usr/bin/env node
/**
 * Lint ratchet: fail CI if ESLint reports MORE errors or warnings than the
 * committed baseline (.github/lint-baseline.json), pass otherwise.
 *
 * Why: the codebase carries existing lint debt, so requiring a clean run would
 * make CI permanently red, and ignoring lint would let new problems in. The
 * ratchet lets the count only go down.
 *
 *   npx eslint . --format json --output-file eslint-report.json || true
 *   node scripts/lint-ratchet.mjs eslint-report.json
 *
 * When the count drops, lower the numbers in the baseline file in the same PR
 * so the improvement is locked in. A missing/unparsable report or any fatal
 * (crash-level) ESLint error fails the run: a broken linter is not a pass.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASELINE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".github",
  "lint-baseline.json"
);

export function summarize(report) {
  if (!Array.isArray(report)) throw new Error("ESLint report must be a JSON array");
  return report.reduce(
    (totals, file) => ({
      errors: totals.errors + (file.errorCount ?? 0),
      warnings: totals.warnings + (file.warningCount ?? 0),
      fatal: totals.fatal + (file.fatalErrorCount ?? 0),
    }),
    { errors: 0, warnings: 0, fatal: 0 }
  );
}

/** @returns {{ ok: boolean, lines: string[] }} */
export function compareToBaseline(current, baseline) {
  const lines = [];
  let ok = true;

  if (current.fatal > 0) {
    ok = false;
    lines.push(`FAIL: ESLint hit ${current.fatal} fatal error(s); the lint result cannot be trusted.`);
  }

  for (const kind of ["errors", "warnings"]) {
    const now = current[kind];
    const allowed = baseline[kind];
    if (!Number.isInteger(allowed) || allowed < 0) {
      throw new Error(`Baseline "${kind}" must be a non-negative integer`);
    }
    if (now > allowed) {
      ok = false;
      lines.push(`FAIL: ${kind} rose from ${allowed} to ${now}. Fix the new ${kind}; do not raise the baseline.`);
    } else if (now < allowed) {
      lines.push(`IMPROVED: ${kind} fell from ${allowed} to ${now}. Lower "${kind}" to ${now} in .github/lint-baseline.json.`);
    } else {
      lines.push(`OK: ${kind} unchanged at ${now}.`);
    }
  }

  return { ok, lines };
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("Usage: lint-ratchet.mjs <eslint-json-report>");
    process.exit(64);
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (err) {
    console.error(`Could not read ESLint report at ${reportPath}: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const { ok, lines } = compareToBaseline(summarize(report), baseline);
  lines.forEach((line) => console.log(line));
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
