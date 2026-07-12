/**
 * Global message notifications are intentionally disabled.
 *
 * `messages` is scoped by conversation membership and has no recipient column.
 * A global table subscription therefore cannot securely distinguish messages
 * intended for the current user without subscribing to every visible message.
 * Re-enable this only after adding server-side recipient routing or a dedicated,
 * recipient-scoped notification model with appropriate RLS.
 */
export function GlobalNotification() {
  return null;
}
