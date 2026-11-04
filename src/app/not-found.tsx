import type { Metadata } from "next";
import Link from "next/link";

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

const primary =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15] px-7 text-sm font-semibold text-[#0B1120] transition-colors hover:from-[#FACC15] hover:to-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1419]";
const secondary =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1419]";

export default function NotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] text-center"
    >
      {/* Brand lockup, as in the app sidebar */}
      <div className="mb-12 flex flex-col items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 -skew-x-12 items-center justify-center bg-[#D4AF37] text-lg font-black leading-none text-[#0B1120]"
        >
          E
        </div>
        <p className="text-xl font-black tracking-tighter text-white">
          REALTY<span className="text-[#D4AF37]">SHARKS</span>
        </p>
      </div>

      <p aria-hidden="true" className="text-8xl font-light leading-none tracking-tighter text-[#D4AF37] sm:text-9xl">
        404
      </p>
      <div aria-hidden="true" className="my-8 h-px w-16 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />

      <h1 id="not-found-title" className="text-2xl font-semibold tracking-tight text-white">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
        This link may be broken, or the page may have moved.
      </p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link href="/dashboard" prefetch={false} className={primary}>
          Go to dashboard
        </Link>
        <Link href="/listings" prefetch={false} className={secondary}>
          Browse listings
        </Link>
      </div>
    </section>
  );
}
