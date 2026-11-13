import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard against a false security claim in the UI.
 *
 * Chat messages are stored as plain text in Postgres and protected by row-level
 * security (only the two participants can read them). They are NOT end-to-end
 * encrypted, and whoever operates the database can read them; the report dialog
 * even tells users "we may review your conversation". Copy that says otherwise
 * misleads brokers about what they are sharing. If the architecture changes (real
 * E2E encryption), delete this test along with the change.
 */
const SRC = new URL("../", import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

describe("UI copy makes no false security claims", () => {
  it("never claims end-to-end encryption", () => {
    const offenders = sourceFiles(SRC).filter((file) => /end[\s-]*to[\s-]*end/i.test(fs.readFileSync(file, "utf8")));
    assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), [], "chat is not end-to-end encrypted; see this test's header");
  });

  it("never shows a Verified badge that is not driven by profiles.verified", () => {
    // Patterns that made every broker look verified: a default of true, a hard-coded true,
    // and a badge derived from a self-entered RERA number. Use isVerifiedBroker() instead.
    const forbidden: [RegExp, string][] = [
      [/isVerified\s*=\s*true/, "isVerified defaulting to true"],
      [/isVerified=\{\s*true\s*\}/, "isVerified={true}"],
      [/isVerified=\{\s*!!/, "isVerified={!!...} (derived from a self-entered field)"],
      [/RERA Verified/i, '"RERA Verified" (a RERA number is self-entered and only format-checked)'],
      // Marketing copy that claims verification nobody has earned (verified comes only from profiles.verified).
      [/verified\s+(platform|institutional)/i, '"verified platform/institutional brokers"'],
      [/Verified Premium Badge/i, '"Verified Premium Badge" (a badge cannot be bought)'],
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, "utf8");
      for (const [pattern, label] of forbidden) if (pattern.test(text)) offenders.push(`${path.relative(SRC, file)}: ${label}`);
    }
    assert.deepEqual(offenders, [], "badges must come from isVerifiedBroker(profile), i.e. profiles.verified");
  });

  it("scans real source (the walk finds the chat component)", () => {
    assert.ok(sourceFiles(SRC).some((f) => f.endsWith(path.join("components", "chat", "ChatArea.tsx"))));
  });
});
