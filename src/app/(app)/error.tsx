"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/**
 * Error boundary for pages inside the app shell. It sits below (app)/layout, so
 * the sidebar and tab bar stay on screen and the person can navigate elsewhere.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorScreen error={error} retry={unstable_retry} fullScreen={false} />;
}
