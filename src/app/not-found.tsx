import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen, statusPrimaryClass, statusSecondaryClass } from "@/components/ui/StatusScreen";

/**
 * The app's 404, shown for any URL that matches no route and for notFound().
 * It also stands in for routes that must not exist in this environment: the
 * proxy rewrites dev-only routes (see src/utils/devOnlyRoutes.ts) here, so they
 * look exactly like any other missing page.
 *
 * It renders inside the root layout only (no sidebar: that shell belongs to the
 * (app) route group), so it is a self-contained screen with the brand mark and
 * two ways back. Signed-out visitors are sent to /login by the proxy before they
 * get here, so "Go to dashboard" is the right primary action for the people who
 * do see this.
 */
export const metadata: Metadata = {
  title: "Page not found | Realtysharks",
};

export default function NotFound() {
  return (
    <StatusScreen code="404" title="Page not found" message="This link may be broken, or the page may have moved.">
      <Link href="/dashboard" prefetch={false} className={statusPrimaryClass}>
        Go to dashboard
      </Link>
      <Link href="/listings" prefetch={false} className={statusSecondaryClass}>
        Browse listings
      </Link>
    </StatusScreen>
  );
}
