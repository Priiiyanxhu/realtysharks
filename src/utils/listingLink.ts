/**
 * Link target for a listing tagged in a chat.
 *
 * The id is not trusted: it arrives through the /messages query string (anyone
 * can craft that URL) and, in message bodies, from another broker's text.
 * listings.id is a uuid, so anything else (path segments such as "../profile",
 * query strings, whitespace, numbers) yields null and the UI shows no link
 * rather than navigating somewhere unintended.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function listingHref(id: unknown): string | null {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return `/listings/${id.toLowerCase()}`;
}
