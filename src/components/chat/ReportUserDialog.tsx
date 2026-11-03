"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  validateReport,
  type ReportOutcome,
} from "@/utils/userReports";

type SubmitResult = ReportOutcome & { extraNote?: string };

interface ReportUserDialogProps {
  open: boolean;
  partnerName: string;
  /** Shown to be honest about what reviewers can see. */
  hasConversation: boolean;
  /** Offered only when the user has not already blocked this broker. */
  canOfferBlock: boolean;
  onSubmit: (values: { reason: string; details: string; alsoBlock: boolean }) => Promise<SubmitResult>;
  onClose: () => void;
}

/**
 * Report dialog on the native <dialog> element (modal, focus trap, Escape,
 * focus return). The form is remounted each time it opens, so no stale input
 * survives. Privacy: the reported broker is never told; the copy says so, and
 * says that the conversation may be reviewed.
 */
export function ReportUserDialog(props: ReportUserDialogProps) {
  const { open, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      onCancel={(event) => {
        // Escape: closing is handled by the form (it can refuse while sending).
        event.preventDefault();
        dialogRef.current?.dispatchEvent(new CustomEvent("report-dismiss"));
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-white/15 bg-[#0A0D12] p-0 text-white shadow-2xl",
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      )}
    >
      {open && <ReportForm key="form" {...props} titleId={titleId} dialogRef={dialogRef} onClose={onClose} />}
    </dialog>
  );
}

function ReportForm({
  partnerName,
  hasConversation,
  canOfferBlock,
  onSubmit,
  onClose,
  titleId,
  dialogRef,
}: ReportUserDialogProps & { titleId: string; dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<SubmitResult | null>(null);

  // Escape and backdrop clicks both end up here; refuse while a send is in flight.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dismiss = () => { if (!sending) onClose(); };
    const backdrop = (event: MouseEvent) => { if (event.target === dialog) dismiss(); };
    dialog.addEventListener("report-dismiss", dismiss);
    dialog.addEventListener("click", backdrop);
    return () => {
      dialog.removeEventListener("report-dismiss", dismiss);
      dialog.removeEventListener("click", backdrop);
    };
  }, [dialogRef, onClose, sending]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validateReport(reason, details);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setProblem(null);
    setSending(true);
    const result = await onSubmit({ reason: reason as string, details, alsoBlock });
    setSending(false);
    if (result.kind === "created" || result.kind === "duplicate") setDone(result);
    else setProblem(result.message);
  };

  if (done) {
    return (
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold text-white">Report sent</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{done.message}</p>
        {done.extraNote && <p className="mt-2 text-sm leading-relaxed text-gray-400">{done.extraNote}</p>}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15] px-5 py-2.5 text-sm font-semibold text-[#0B1120]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6" noValidate>
      <h2 id={titleId} className="text-lg font-semibold text-white">Report {partnerName}</h2>
      <p className="mt-1 text-sm text-gray-400">
        {`Your report is private: ${partnerName} isn't told.`}
        {hasConversation ? " We may review your conversation with them to look into it." : ""}
      </p>

      <fieldset className="mt-5" disabled={sending}>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Why are you reporting them?</legend>
        <div className="space-y-1.5">
          {REPORT_REASONS.map((option, index) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors",
                reason === option.value ? "border-[#D4AF37]/60 bg-[#D4AF37]/10 text-white" : "border-white/10 text-gray-300 hover:bg-white/5"
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => { setReason(option.value); setProblem(null); }}
                autoFocus={index === 0}
                className="h-4 w-4 accent-[#D4AF37]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="report-details" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Details {reason === "other" ? "(required)" : "(optional)"}
        </label>
        <textarea
          id="report-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          disabled={sending}
          rows={3}
          maxLength={REPORT_DETAILS_MAX + 200}
          placeholder="What happened?"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#D4AF37]/50"
        />
        <p className={cn("mt-1 text-right text-xs", details.trim().length > REPORT_DETAILS_MAX ? "text-red-400" : "text-gray-600")}>
          {details.trim().length}/{REPORT_DETAILS_MAX}
        </p>
      </div>

      {canOfferBlock && (
        <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(event) => setAlsoBlock(event.target.checked)}
            disabled={sending}
            className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
          />
          <span>Also block {partnerName}. Neither of you will be able to send new messages.</span>
        </label>
      )}

      {problem && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {problem}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
