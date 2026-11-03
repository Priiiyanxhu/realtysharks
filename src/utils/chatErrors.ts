/**
 * Turns database / API chat failures into messages a broker can act on.
 *
 * COUPLING: the three database message strings below are raised by
 * public.get_or_create_direct_conversation (migration
 * 20261103120600_restrict_chat_creation_and_blocks.sql) and pinned by
 * supabase/tests/database/09_chat_restrictions.test.sql. Change them together.
 * SQLSTATE alone cannot tell "not onboarded" from "cannot be messaged" (both
 * are 42501), so the message text is the discriminator.
 *
 * Privacy: "recipient not onboarded" and "blocked in either direction" share
 * one database error on purpose, so a blocked user can't tell they were
 * blocked. Nothing here may reintroduce that distinction in user-facing copy.
 */

export type ChatErrorKind =
  | "daily_limit"
  | "not_onboarded"
  | "cannot_message"
  | "profile_missing"
  | "signed_out"
  | "send_rejected"
  | "unknown";

export type ChatErrorInfo = { kind: ChatErrorKind; message: string };

type RawError = { code?: string | null; message?: string | null } | null | undefined;

const DB_MESSAGES = {
  dailyLimit: "daily new conversation limit reached",
  notOnboarded: "complete onboarding before starting conversations",
  cannotMessage: "this user cannot be messaged",
} as const;

const COPY: Record<ChatErrorKind, string> = {
  daily_limit:
    "You've reached today's limit for starting new conversations. You can still reply in your existing chats, or try again tomorrow.",
  not_onboarded: "Finish setting up your profile to start conversations.",
  cannot_message: "You can't message this broker right now.",
  profile_missing: "This broker's profile is no longer available.",
  signed_out: "Your session has expired. Please sign in again.",
  send_rejected:
    "This message couldn't be delivered. You may no longer be able to message this broker.",
  unknown: "Something went wrong. Please try again.",
};

function isSignedOut(code: string, text: string): boolean {
  return code === "28000" || code === "PGRST301" || code === "401" || text.includes("jwt");
}

/** Errors from the get_or_create_direct_conversation RPC. */
export function describeStartChatError(error: RawError): ChatErrorInfo {
  const code = error?.code ?? "";
  const text = (error?.message ?? "").toLowerCase();

  let kind: ChatErrorKind = "unknown";
  if (code === "54000" || text.includes(DB_MESSAGES.dailyLimit)) kind = "daily_limit";
  else if (text.includes(DB_MESSAGES.notOnboarded)) kind = "not_onboarded";
  else if (text.includes(DB_MESSAGES.cannotMessage)) kind = "cannot_message";
  else if (isSignedOut(code, text)) kind = "signed_out";
  else if (code === "23503") kind = "profile_missing";

  return { kind, message: kind === "unknown" ? "We couldn't start this conversation. Please try again." : COPY[kind] };
}

/** Errors from inserting a message. */
export function describeSendError(error: RawError): ChatErrorInfo {
  const code = error?.code ?? "";
  const text = (error?.message ?? "").toLowerCase();

  if (isSignedOut(code, text)) return { kind: "signed_out", message: COPY.signed_out };
  // Row-level-security rejection: not a participant, or a block is in place.
  if (code === "42501") return { kind: "send_rejected", message: COPY.send_rejected };
  return { kind: "unknown", message: "Your message couldn't be sent. Please try again." };
}
