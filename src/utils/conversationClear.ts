/**
 * "Clear Chat" hides a conversation's current messages from the clearer's own
 * view only (public.clear_conversation_history, migration
 * 20261103121000_clear_conversation_history.sql). Nothing is deleted and the
 * other participant is unaffected. The marker is server time, so it is compared
 * with messages.created_at (also server time), never with the client's clock.
 */

type Visible = { created_at: string; id?: string };

/**
 * True when a message should still be shown given the conversation's clear
 * marker. Fails OPEN: an unparsable marker or timestamp shows the message, so a
 * bad value can never silently hide a conversation.
 */
export function isVisibleAfterClear(message: Visible, clearedAt: string | null | undefined): boolean {
  if (!clearedAt) return true;
  // An optimistic message the user just sent carries the CLIENT's clock; it is
  // replaced by the server's version (with a server timestamp) moments later.
  if (message.id?.startsWith("temp-")) return true;
  const cleared = Date.parse(clearedAt);
  const created = Date.parse(message.created_at);
  if (Number.isNaN(cleared) || Number.isNaN(created)) return true;
  return created > cleared;
}

export function filterClearedMessages<T extends Visible>(messages: T[], clearedAt: string | null | undefined): T[] {
  if (!clearedAt) return messages;
  return messages.filter((message) => isVisibleAfterClear(message, clearedAt));
}

export function describeClearError(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const code = error?.code ?? "";
  const text = (error?.message ?? "").toLowerCase();
  if (code === "28000" || code === "PGRST301" || text.includes("jwt")) {
    return "Your session has expired. Please sign in again.";
  }
  return "We couldn't clear this chat. Please try again.";
}
