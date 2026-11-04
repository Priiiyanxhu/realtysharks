"use client";

// The root layout is not rendered when this shows, so its stylesheet is not loaded.
import "./globals.css";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/**
 * Last resort: an error in the root layout itself. It replaces the whole document,
 * so it brings its own <html> and <body>. Error boundaries cannot export metadata,
 * hence the in-body <title> (React hoists it to <head>).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="flex min-h-full flex-col bg-[#0F1419] text-[#F3F4F6] select-none">
        <title>Something went wrong | Realtysharks</title>
        <main className="flex-grow">
          <ErrorScreen error={error} retry={unstable_retry} />
        </main>
      </body>
    </html>
  );
}
