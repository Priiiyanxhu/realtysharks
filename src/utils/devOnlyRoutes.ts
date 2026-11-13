/**
 * Routes that exist only for development (component playgrounds with dummy data).
 * In any other environment the proxy answers 404 before auth or rendering, so
 * they cannot be opened, and a dummy "Verified" card cannot be mistaken for real.
 *
 * To add one, list its path here (a test checks the page exists under src/app).
 */
export const DEV_ONLY_PATHS = ["/testbed"] as const;

/**
 * Collapse a request path the way the router effectively does, so that
 * "/./testbed", "/dashboard/../testbed", "/%2e/testbed", "//testbed" and
 * "/testbed/" all become "/testbed" before comparison. Case is folded and a
 * trailing slash dropped; malformed input falls back to the raw lower-cased path
 * (it will not route anywhere, and an over-block is harmless).
 */
function normalizePath(pathname: string): string {
  const rooted = pathname.startsWith("/") ? pathname : `/${pathname}`;
  let path = rooted;
  try {
    // WHATWG URL resolves "." / ".." segments, including percent-encoded ones.
    path = new URL(`http://localhost${rooted}`).pathname;
  } catch {
    // keep the raw path
  }
  return path.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1").toLowerCase();
}

/** True when `pathname` is a dev-only route or sits under one. */
export function isDevOnlyPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return DEV_ONLY_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
}

/**
 * True when the request must be refused: the path is dev-only and this is not a
 * development server. Only NODE_ENV === "development" opens these routes, so a
 * missing, "test" or "production" value all keep them closed.
 */
export function isBlockedInThisEnv(pathname: string, nodeEnv: string | undefined): boolean {
  return nodeEnv !== "development" && isDevOnlyPath(pathname);
}
