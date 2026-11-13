import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEV_ONLY_PATHS, isBlockedInThisEnv, isDevOnlyPath } from "./devOnlyRoutes.ts";

describe("isDevOnlyPath", () => {
  it("matches the route and anything under it", () => {
    for (const p of ["/testbed", "/testbed/", "/testbed/anything", "/testbed/a/b"]) assert.equal(isDevOnlyPath(p), true, p);
  });

  it("matches every spelling the router resolves to the route (dot segments, doubled slashes, encoded dots, case)", () => {
    const spellings = [
      "//testbed", "///testbed//", "/./testbed", "/testbed/.", "/testbed/./", "/dashboard/../testbed",
      "/%2e/testbed", "/%2E/testbed", "/testbed/%2e%2e/testbed", "/testbed/%2E%2E/testbed", "/dashboard/%2e%2e/testbed",
      "/TESTBED", "/TestBed", "/a/b/../../testbed",
    ];
    for (const p of spellings) assert.equal(isDevOnlyPath(p), true, p);
  });

  it("does not block unrelated routes, including look-alikes", () => {
    for (const p of ["/", "/dashboard", "/network", "/network/testbed", "/listings/testbed", "/testbedx", "/test", "/mytestbed", "/testbeds", "/api/testbed"]) {
      assert.equal(isDevOnlyPath(p), false, p);
    }
  });

  it("survives malformed input without throwing", () => {
    for (const p of ["", "testbed", "/%", "/%zz", "/testbed%00", "http://evil.example/testbed", "/\\testbed", "\u0000"]) {
      assert.doesNotThrow(() => isDevOnlyPath(p), p);
    }
    assert.equal(isDevOnlyPath("testbed"), true, "a path missing its leading slash is still treated as the route");
    assert.equal(isDevOnlyPath(""), false);
  });
});

describe("isBlockedInThisEnv", () => {
  it("opens the route only when NODE_ENV is exactly 'development'", () => {
    assert.equal(isBlockedInThisEnv("/testbed", "development"), false);
    for (const env of ["production", "test", "staging", "Development", "dev", "", undefined]) {
      assert.equal(isBlockedInThisEnv("/testbed", env), true, String(env));
    }
  });

  it("never blocks ordinary routes, in any environment", () => {
    for (const env of ["development", "production", "test", undefined]) {
      assert.equal(isBlockedInThisEnv("/dashboard", env), false, String(env));
    }
  });
});

describe("the dev-only list stays honest", () => {
  const SRC = new URL("../", import.meta.url).pathname;
  const routeExists = (route: string) => {
    const stack = [path.join(SRC, "app")];
    while (stack.length) {
      const dir = stack.pop() as string;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name) && path.relative(path.join(SRC, "app"), dir).split(path.sep).filter((s) => !/^\(.*\)$/.test(s)).join("/") === route.slice(1)) return true;
      }
    }
    return false;
  };

  it("every listed route has a page (a renamed folder would silently un-gate nothing)", () => {
    for (const route of DEV_ONLY_PATHS) assert.equal(routeExists(route), true, `${route} has no page under src/app; update DEV_ONLY_PATHS`);
  });

  it("the page-finder really finds routes (so the check above is not vacuous)", () => {
    assert.equal(routeExists("/dashboard"), true);
    assert.equal(routeExists("/definitely-not-a-route"), false);
  });

  it("the app has its own not-found page, which is what the gate's rewrite renders", () => {
    const file = path.join(SRC, "app", "not-found.tsx");
    assert.equal(fs.existsSync(file), true, "src/app/not-found.tsx is missing: dev-only routes would show Next's default 404");
    const text = fs.readFileSync(file, "utf8");
    assert.match(text, /export default function/);
    assert.match(text, /Page not found/);
    assert.match(text, /href="\/dashboard"/, "the 404 must offer a way back into the app");
  });

  it("the proxy applies the gate before it does anything else", () => {
    const proxy = fs.readFileSync(path.join(SRC, "proxy.ts"), "utf8");
    assert.match(proxy, /isBlockedInThisEnv\(/);
    assert.ok(proxy.indexOf("isBlockedInThisEnv(") < proxy.indexOf("createServerClient("), "the gate must run before auth/session work");
  });
});
