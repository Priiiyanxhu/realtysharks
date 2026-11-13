import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards for the 500 pages (Next's default is a white page that clashes with the app).
 * Browser behaviour is checked against a production build; these keep the structure
 * that makes it work, and the rule that an error's message is never shown.
 */
const SRC = new URL("../", import.meta.url).pathname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
const BOUNDARIES = ["app/error.tsx", "app/(app)/error.tsx", "app/global-error.tsx"];

describe("error boundaries", () => {
  it("exist at the root, inside the app shell, and for the root layout", () => {
    for (const file of BOUNDARIES) assert.equal(fs.existsSync(path.join(SRC, file)), true, `${file} is missing: errors would show Next's default page`);
  });

  it("are client components (React error boundaries must be)", () => {
    for (const file of [...BOUNDARIES, "components/ui/ErrorScreen.tsx"]) assert.match(read(file).trimStart(), /^["']use client["'];?/, file);
  });

  it("retry with Next 16's unstable_retry", () => {
    for (const file of BOUNDARIES) assert.match(read(file), /unstable_retry/, file);
  });

  it("global-error brings its own <html> and <body>, and the stylesheet the missing root layout would have loaded", () => {
    const text = read("app/global-error.tsx");
    assert.match(text, /<html[\s>]/);
    assert.match(text, /<body[\s>]/);
    assert.match(text, /import "\.\/globals\.css"/);
  });

  it("the in-shell boundary is not full screen, so the sidebar stays useful", () => {
    assert.match(read("app/(app)/error.tsx"), /fullScreen=\{false\}/);
  });
});

describe("what an error screen may show", () => {
  it("never renders error.message or the stack (a client error carries its real message)", () => {
    for (const file of [...BOUNDARIES, "components/ui/ErrorScreen.tsx", "components/ui/StatusScreen.tsx"]) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      assert.doesNotMatch(code, /error\.message|error\.stack|\.stack\b/, `${file} would expose internals`);
    }
  });

  it("shows the digest as a reference, selectable so it can be copied from the select-none body", () => {
    assert.match(read("components/ui/ErrorScreen.tsx"), /reference=\{error\.digest\}/);
    assert.match(read("components/ui/StatusScreen.tsx"), /select-text/);
  });

  it("offers a way back that does not depend on client state (a plain link)", () => {
    assert.match(read("components/ui/ErrorScreen.tsx"), /<a href="\/dashboard"/);
  });
});
