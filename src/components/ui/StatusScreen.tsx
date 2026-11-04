import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The shared full-screen status layout (404, 500): brand mark, a large gold code,
 * one heading, one line of explanation and the actions. One source so the two
 * screens cannot drift apart. No hooks and no "use client", so both a server page
 * (not-found) and a client error boundary can render it.
 *
 * `fullScreen={false}` is for a screen shown inside the app shell: no brand lockup
 * (the shell has it) and a shorter minimum height.
 */
export const statusPrimaryClass =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15] px-7 text-sm font-semibold text-[#0B1120] transition-colors hover:from-[#FACC15] hover:to-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1419]";
export const statusSecondaryClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1419]";

export function StatusScreen({
  code,
  title,
  message,
  reference,
  fullScreen = true,
  children,
}: {
  code: string;
  title: string;
  message: string;
  /** Support reference (an error digest). Selectable, so it can be copied. */
  reference?: string;
  fullScreen?: boolean;
  /** The actions: links or buttons styled with statusPrimaryClass / statusSecondaryClass. */
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="status-title"
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        fullScreen
          ? "min-h-[100dvh] pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]"
          : "min-h-[70dvh] py-16"
      )}
    >
      {fullScreen && (
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
      )}

      <p aria-hidden="true" className="text-8xl font-light leading-none tracking-tighter text-[#D4AF37] sm:text-9xl">
        {code}
      </p>
      <div aria-hidden="true" className="my-8 h-px w-16 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />

      <h1 id="status-title" className="text-2xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">{message}</p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">{children}</div>

      {reference && (
        // body is select-none app-wide; select-text lets someone copy the reference.
        <p data-error-reference className="mt-10 select-text font-mono text-xs text-white/50">
          Reference {reference}
        </p>
      )}
    </section>
  );
}
