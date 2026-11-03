import { isUuid } from "./listingLink.ts";

/**
 * Link to a broker's profile page (/network/{broker id}), optionally opened on
 * their Requirements tab. The profile page looks the id up as a BROKER in
 * profiles_public, so never pass it a listing or requirement id: it lands on
 * "Broker Not Found". Returns null for anything that is not a well-formed uuid
 * (a missing broker_id, for instance), so callers can omit the link.
 */
export function brokerProfileHref(brokerId: unknown, tab?: "requirements"): string | null {
  if (!isUuid(brokerId)) return null;
  return `/network/${brokerId.toLowerCase()}${tab ? `?tab=${tab}` : ""}`;
}
