"use client";

import { useEffect } from "react";
import { StatusScreen, statusPrimaryClass, statusSecondaryClass } from "./StatusScreen";

/**
 * The 500 screen every error boundary renders (src/app/error.tsx,
 * src/app/(app)/error.tsx, src/app/global-error.tsx).
 *
 * Shows only the digest, never error.message: errors from server components
 * arrive with a generic message and a digest that matches the server log, but an
 * error thrown in client code carries its real message, which may expose
 * internals. "Try again" uses Next's unstable_retry (re-fetches and re-renders);
 * "Go to dashboard" is a plain link so it works even when client state is broken.
 */
export function ErrorScreen({
  error,
  retry,
  fullScreen = true,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      title="Something went wrong"
      message="We couldn't load this page. Try again, or head back to your dashboard."
      reference={error.digest}
      fullScreen={fullScreen}
    >
      <button type="button" onClick={retry} className={statusPrimaryClass}>
        Try again
      </button>
      <a href="/dashboard" className={statusSecondaryClass}>
        Go to dashboard
      </a>
    </StatusScreen>
  );
}
