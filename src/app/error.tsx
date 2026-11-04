"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Error boundary for every route outside the (app) shell (landing, login, register...). */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorScreen error={error} retry={unstable_retry} />;
}
