import { listingHref } from "./listingLink.ts";

/**
 * A chat message can carry a listing tag in its body:
 *
 *   __TAG_LISTING:{id}|{title}|{price}|{location}__\n{message text}
 *
 * (written by the send handler in the Messages page). The body is authored by
 * the OTHER broker, so every field is untrusted text; React escapes it when
 * rendered, and the link target is only ever built by listingHref(), which
 * accepts nothing but a well-formed uuid.
 *
 * The pattern is the one the component used inline before, unchanged, so every
 * message already stored parses exactly as it did. Known limits of the format
 * (not changed here): a "|" in the title or price does not stop the match but
 * shifts the fields (the card shows the wrong title/price/location), and an "_"
 * in the location stops it matching, so the raw tag text stays in the message.
 * A sturdier encoding is a separate change.
 */
const TAG = /__TAG_LISTING:([^|]+)\|([^|]+)\|([^|]+)\|([^_\n]+)__/;

export type ListingTag = { id: string; title: string; price: string; location: string };

export type ParsedListingTag = {
  /** The tagged listing, or null when the message carries none. */
  listing: ListingTag | null;
  /** Where the card should link, or null when there is no tag or its id is not a valid listing id. */
  href: string | null;
  /** The message text with the tag removed. */
  text: string;
};

export function parseListingTag(content: string): ParsedListingTag {
  const match = content.match(TAG);
  if (!match) return { listing: null, href: null, text: content };
  const listing = { id: match[1], title: match[2], price: match[3], location: match[4] };
  return { listing, href: listingHref(listing.id), text: content.replace(match[0], "").trim() };
}
