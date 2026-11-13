/**
 * Turns the result of public.consume_ai_quota() (migration
 * 20261103120800_ai_usage_rate_limit.sql) into an HTTP decision for
 * /api/ai-autowrite.
 *
 * Fails CLOSED: anything that is not an explicit `allowed: true` from the
 * database means the request is not made, because this gate exists to protect
 * paid usage. A missing function (migration not applied) or a database error
 * therefore turns AI writing off (503) instead of leaving it unmetered.
 */

export type QuotaDecision =
  | { kind: "allowed" }
  | { kind: "limited"; status: 429; retryAfterSeconds: number; message: string }
  | { kind: "unavailable"; status: 503; message: string };

type RawError = { code?: string | null; message?: string | null } | null | undefined;

const UNAVAILABLE: QuotaDecision = {
  kind: "unavailable",
  status: 503,
  message: "AI writing is temporarily unavailable. Please try again shortly.",
};

/** "12 seconds", "about 3 minutes", "about 2 hours". Never rounds down to zero. */
export function formatWait(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  if (seconds < 90) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function interpretQuotaResult(data: unknown, error: RawError): QuotaDecision {
  if (error) return UNAVAILABLE;

  // PostgREST returns a jsonb scalar as an object; tolerate a one-element array too.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return UNAVAILABLE;

  const { allowed, retry_after_seconds: retry, limit_scope: scope } = row as {
    allowed?: unknown;
    retry_after_seconds?: unknown;
    limit_scope?: unknown;
  };

  if (allowed === true) return { kind: "allowed" };
  if (allowed !== false) return UNAVAILABLE;

  const retryAfterSeconds = typeof retry === "number" && Number.isFinite(retry) ? Math.max(1, Math.ceil(retry)) : 60;

  // Global exhaustion is not the user's doing: don't blame them or quote a number.
  if (scope === "global") {
    return {
      kind: "limited",
      status: 429,
      retryAfterSeconds,
      message: "AI writing is very busy right now. Please try again later.",
    };
  }
  if (scope === "day") {
    return {
      kind: "limited",
      status: 429,
      retryAfterSeconds,
      message: `You've reached today's AI writing limit. You can use it again in ${formatWait(retryAfterSeconds)}.`,
    };
  }
  return {
    kind: "limited",
    status: 429,
    retryAfterSeconds,
    message: `You're generating too quickly. Please wait ${formatWait(retryAfterSeconds)} and try again.`,
  };
}
