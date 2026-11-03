"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button red for destructive actions. */
  tone?: "default" | "danger";
  /** While true the dialog cannot be dismissed and the confirm button shows a busy state. */
  busy?: boolean;
  /** Shown inside the dialog when the confirmed action failed. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation built on the native <dialog> element, which supplies the
 * focus trap, Escape handling, inert background and focus return for free.
 * Initial focus goes to Cancel so Enter never fires a destructive action.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: let the parent decide, unless an action is in flight.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      // A click on the dialog box itself (not its content) is a backdrop click.
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-white/15 bg-[#0A0D12] p-0 text-white shadow-2xl",
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      )}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-gray-400">
          {description}
        </div>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={onCancel}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
              tone === "danger"
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-gradient-to-r from-[#D4AF37] to-[#FACC15] text-[#0B1120]"
            )}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
