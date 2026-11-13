import type { SupabaseClient } from "@supabase/supabase-js";
import { formatWait } from "./aiQuota.ts";

/**
 * Reporting a broker from the chat menu (public.report_user, migration
 * 20261103120900_user_reports.sql).
 *
 * The reason values must match the database CHECK constraint and report_user();
 * a unit test reads the migration file and fails if this list drifts.
 */
export const REPORT_REASONS = [
  { value: "spam", label: "Spam or unwanted promotion" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "fake_profile", label: "Fake profile or impersonation" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_DETAILS_MAX = 1000;

/** Returns a user-facing problem with the form, or null when it can be sent. */
export function validateReport(reason: string | null, details: string): string | null {
  if (!reason || !REPORT_REASONS.some((r) => r.value === reason)) return "Please choose a reason.";
  const trimmed = details.trim();
  if (trimmed.length > REPORT_DETAILS_MAX) return `Please keep the details under ${REPORT_DETAILS_MAX} characters.`;
  if (reason === "other" && trimmed.length === 0) return "Please tell us what happened.";
  return null;
}

export type ReportOutcome =
  | { kind: "created" | "duplicate"; message: string }
  | { kind: "rate_limited" | "error"; message: string };

type RawError = { code?: string | null; message?: string | null } | null | undefined;

const GENERIC_ERROR = "We couldn't send your report. Please try again.";

export function interpretReportResult(data: unknown, error: RawError): ReportOutcome {
  if (error) {
    const code = error.code ?? "";
    const text = (error.message ?? "").toLowerCase();
    if (code === "28000" || code === "PGRST301" || text.includes("jwt")) {
      return { kind: "error", message: "Your session has expired. Please sign in again." };
    }
    return { kind: "error", message: GENERIC_ERROR };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row && typeof row === "object" ? (row as { status?: unknown }).status : undefined;

  if (status === "created") {
    return {
      kind: "created",
      message: "Thank you. Your report has been sent for review. The other broker isn't told that you reported them.",
    };
  }
  if (status === "duplicate") {
    return {
      kind: "duplicate",
      message: "You've already reported this broker for this reason. We're reviewing it.",
    };
  }
  if (status === "rate_limited") {
    const retry = (row as { retry_after_seconds?: unknown }).retry_after_seconds;
    const wait = typeof retry === "number" && Number.isFinite(retry) ? ` Please try again in ${formatWait(retry)}.` : " Please try again later.";
    return { kind: "rate_limited", message: `You've sent several reports today.${wait}` };
  }
  return { kind: "error", message: GENERIC_ERROR };
}

export async function reportUser(
  client: SupabaseClient,
  args: { reportedId: string; reason: string; details: string; conversationId?: string | null }
): Promise<ReportOutcome> {
  const problem = validateReport(args.reason, args.details);
  if (problem) return { kind: "error", message: problem };

  try {
    const trimmed = args.details.trim();
    const { data, error } = await client.rpc("report_user", {
      p_reported_id: args.reportedId,
      p_reason: args.reason,
      p_details: trimmed.length > 0 ? trimmed : null,
      p_conversation_id: args.conversationId ?? null,
    });
    return interpretReportResult(data, error);
  } catch {
    return { kind: "error", message: GENERIC_ERROR };
  }
}
