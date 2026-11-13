# Backend: data access, privacy, chat, AI, migrations

Read this before changing a query, policy, RPC, storage rule, chat behaviour, the AI route or a migration. [`CLAUDE.md`](../CLAUDE.md) holds the invariants; this file holds the detail and the reasons.

## Access model

- **Browser client:** `@/utils/supabase/client`. `src/lib/supabase.ts`, `src/lib/gemini.ts` and `@supabase/auth-helpers-nextjs` are unused leftovers; keep them out of new code.
- **Server identity:** `getVerifiedUserId()` in `src/utils/supabase/server.ts` verifies the JWT with `getClaims()`. `getSession()` only decodes the cookie, so a forged cookie passes it.
- **Profiles:** `profiles.id` = `auth.users.id`, and `auth_id` mirrors it (the app queries by `auth_id`). Read other brokers from `profiles_public`. Email, phone and Aadhaar live in owner-only `profiles_private`.
- **Requirements:** read other brokers' from `requirements_feed`, your own from the table (owner-only once the rollout step under Migrations is applied). No requirement detail page exists: a requirement shows on its broker's profile (`/network/{broker id}?tab=requirements`, built by `brokerProfileHref`), and `/network/[id]` takes a BROKER id.
- **Storage:** objects live under `{auth.uid()}/…` in every bucket and RLS enforces the folder. `avatars`, `covers` and `listing-images` are public (images render by URL); `kyc-documents` is private. Avatar and cover uploads go through `src/utils/profileImages.ts`. Remove files through the Storage API: `DELETE FROM storage.objects` leaves the real file in the object store (orphan cleanup: `scripts/cleanup-orphaned-avatars.mjs`, dry run by default, header documents it).

## Privacy model (enforced in the database)

- **Trust columns:** `verified`, `is_verified`, `kyc_status` and `auth_id` on `profiles` are writable only by `service_role`/`postgres` (trigger). Clients may only reset `kyc_status` to `'pending'`. No admin review flow exists yet; build it server-side with the service-role key.
- **`requirements.privacy_level`:** `Standard` (or NULL) is fully visible. Anything else is masked for non-owners in `requirements_feed`: `funding_status`, `purchase_purpose`, `preferred_localities`, `client_profile` and `details` return NULL. Add every new client-identifying column to the view's mask list.
- **Chat creation:** both users onboarded (`profiles.onboarded`), no block either way, and a cap on new conversations per caller per rolling 24h (constant in the RPC). Reopening an existing chat is always allowed.
- **Blocks:** `user_blocks` also stops new messages in existing chats. The UI (`useBlocks`, `ConfirmDialog`, `BlockedBrokersPanel`) offers block/unblock from the chat header menu and an unblock list on the profile page. A blocked person is never shown that they are blocked.
- **Reports:** `user_reports` is RLS-on with no client grants; brokers file through `report_user` (reason allow-list mirrored by `userReports.test.ts`, length limit, `other` needs details, the reporter must share the conversation they cite, one open report per reporter+reported+reason, a cap per rolling 24h). The reported broker is never told. Nothing in the app reads reports yet: review them as `service_role` or in the SQL editor (query in the migration header). The dialog's "also block" uses the normal block path.
- **Clear chat:** a per-user hide, never a deletion. `conversation_clears` holds one server-time marker per (conversation, user), readable only by its owner and written only by `clear_conversation_history`. The other participant and the messages are untouched. The marker is compared with `messages.created_at` (both server time); an unparsable value fails open and shows the message.

## Chat behaviour

- Start conversations with the `get_or_create_direct_conversation` RPC (INSERT on `conversations` and `conversation_participants` is revoked) and mark read with `mark_conversation_messages_read`. Send messages by direct insert under RLS. Realtime subscribes per conversation. `GlobalNotification` is a deliberate stub: messages have no recipient column to scope a global feed.
- **Error copy:** `src/utils/chatErrors.ts` maps the RPC's error messages to user-facing text. `chatErrors.test.ts` and pgTAP 09 each pin the exact strings, so change the RPC and the mapper together.
- **Header menu:** View Profile opens `/network/{id}`; Report User calls `report_user` through `ReportUserDialog` and `src/utils/userReports.ts`; Clear Chat calls `clear_conversation_history` and the UI hides messages older than the marker (`src/utils/conversationClear.ts`).
- **Listing links in chat:** the "Discussing … View Listing →" bar and the message-bubble "Inquiry Context" card link to `/listings/{id}` only when the id is a well-formed UUID (`listingHref`, `parseListingTag`). The bar's id comes from the `/messages` query string and the card's from another broker's message text, so both are untrusted input.

## Claims the UI may make

Say only what the system enforces; each guard below fails the build.

- **Encryption:** chat is not end-to-end encrypted. Messages are plain text in Postgres, readable by the two participants (RLS) and by whoever operates the database. Copy says "a direct conversation that other brokers can't see"; the listing contact card says "Private • In-App Messaging Only" (that page shows no phone or email). `src/utils/securityClaims.test.ts` fails on "end-to-end".
- **Verification:** show a "Verified" badge or label only for `isVerifiedBroker(profile)` (`src/utils/verification.ts`: `profiles.verified === true`, read through `profiles_public` or the profiles embed). A self-entered field (`rera_number`), a match score or a default of `true` earns no badge. The same test fails on `isVerified={true}`, a `true` default, `isVerified={!!…}` and "RERA Verified".

## AI route

`/api/ai-autowrite` (Gemini, server-only key) runs in this order: verify the caller, validate the body (size cap), spend quota with the `consume_ai_quota()` RPC, then call Gemini. Bad requests never spend quota. It fails closed: any quota-check failure is a 503 and Gemini is not called. A denial is a 429 with `Retry-After` and a plain-language `error`, which the post-listing and post-requirement pages show beside the AI button (`aiError`). Per-user and global limits live in the function (see the header of `20261103120800_ai_usage_rate_limit.sql`). Signup is open, so new accounts sidestep per-user limits; the global cap is the cost backstop.

## Migrations and database tests

- `supabase/migrations/` is the source of truth and replays cleanly from empty. Add forward-only migrations and leave applied ones untouched. Each states its rollout notes in its header.
- **Which migrations production has is the owner's to say.** Treat all as unapplied until told.
- **Rollout order:** `20261103120300_requirements_base_select_owner_only` ships *after* the frontend that reads `requirements_feed`; before that, feeds show only the viewer's own requirements. It refuses to run if the view is missing. `20261103120800_ai_usage_rate_limit` goes the other way: apply it *before* the code that calls `consume_ai_quota()`, because the route fails closed (503) when the function is missing, which turns AI writing off. Apply `20261103120900_user_reports` and `20261103121000_clear_conversation_history` before or with the chat-menu frontend (they are independent): until they exist, Report and Clear Chat show a generic retryable error, and the app shows nothing as cleared when `conversation_clears` is missing. `20261103121100_grant_profiles_table_privileges` is independent of any app change and safe at any point: it states `profiles` and `profiles_private` grants explicitly (they had relied on the platform's default privileges, which current Supabase images no longer give new tables, so a fresh replay left `profiles` unreachable) and takes the table privileges away from `anon` and `PUBLIC`. Every new table must state its own grants the same way; never rely on defaults.
- **pgTAP** suites live in `supabase/tests/database/` (`npx supabase test db`, needs the local stack). Fixtures that start chats need users with `onboarded = true`. Write each new policy or RPC test so it fails before the migration and passes after.
- **Hard to see in review:** RLS cannot hide single columns (use a view); `requirements_feed` is deliberately a SECURITY DEFINER view (it runs with its owner's rights to read rows the base table's owner-only policy hides; Supabase's linter flags it, and that is expected); Storage upsert needs the owner SELECT policy as well as INSERT and UPDATE.
