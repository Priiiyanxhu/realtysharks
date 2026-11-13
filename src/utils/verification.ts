/**
 * Whether a broker may be shown with a "Verified" badge.
 *
 * The ONLY source of truth is `profiles.verified`, which clients can never set
 * (trigger `protect_profile_trust_columns`; only the service role, after a real
 * review, can). It is exposed through `profiles_public` and the profiles embed.
 *
 * Do NOT derive a badge from anything a broker types about themselves: a RERA
 * number is self-entered and only format-checked, a high AI match score says
 * nothing about the broker, and a default of `true` shows the badge to everyone.
 * Strictly `=== true`: a string like "true" or a truthy value does not count.
 *
 * Accepts the profile as an object or as the one-element array PostgREST returns
 * for an embedded relation.
 */
export function isVerifiedBroker(profile: unknown): boolean {
  const row = Array.isArray(profile) ? profile[0] : profile;
  return typeof row === "object" && row !== null && (row as { verified?: unknown }).verified === true;
}
