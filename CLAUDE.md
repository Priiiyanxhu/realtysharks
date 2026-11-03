@AGENTS.md

# Realtysharks

Mobile-first B2B real-estate network for Indian brokers, channel partners, developers, consultants and agents: post **listings** and buyer **requirements**, match them, chat directly, trust verified peers. A premium professional network, not a consumer portal. AGENTS.md (imported above) holds the security rules, required checks, workflow, completed work and priorities. This file holds architecture, conventions and gotchas. *Verified against the repo 2026-11-03.*

## Architecture

- **Supabase is the backend.** The browser queries Postgres directly, so RLS is the access control. Reason about every new query as "what can any logged-in broker do with this?".
- **Browser client:** `@/utils/supabase/client`. `src/lib/supabase.ts`, `src/lib/gemini.ts` and `@supabase/auth-helpers-nextjs` are unused.
- **Server identity:** `getVerifiedUserId()` in `src/utils/supabase/server.ts` (`getClaims()` verifies the JWT). Server code treats `getSession()` as untrusted: it only decodes the cookie, and a forged cookie passes it.
- **Route gate:** `src/proxy.ts` (Next 16 name for middleware). `/api/*` returns 401 and pages redirect to `/login`. `ProtectedRoute`/`GlobalLayout` are client-side extras. `/update-password` stays protected on purpose: `/auth/callback` exchanges the emailed code for a session first.
- **AI:** `/api/ai-autowrite` (Gemini, server-only key). Order: verify the caller, validate the body (size cap), then spend quota via the `consume_ai_quota()` RPC (5 per minute and 50 per 24h per user, 2000 per 24h across all users; constants in the function), then call Gemini. Bad requests never spend quota. It fails closed: any quota-check failure is a 503 and Gemini is not called. A denial is a 429 with `Retry-After` and a plain-language `error` that the post-listing and post-requirement pages show next to the AI button (`aiError`). The global cap is the backstop for account farming, since signup is open and per-user limits can be sidestepped with new accounts.
- **Profiles:** `profiles.id` = `auth.users.id`, and `auth_id` mirrors it (the app queries by `auth_id`). Other brokers' profiles are read from the `profiles_public` view. Email, phone and Aadhaar live in owner-only `profiles_private`.
- **Requirements:** read other brokers' requirements from `requirements_feed`; read your own from the table, which is owner-only once the rollout step below is applied. Details under "Privacy model".
- **Chat:** start conversations with the `get_or_create_direct_conversation` RPC (INSERT on `conversations`/`conversation_participants` is revoked) and mark read with `mark_conversation_messages_read`. Messages are sent by direct insert under RLS. Realtime subscribes per conversation. Rejections become user-facing copy in `src/utils/chatErrors.ts`, which matches the RPC's error messages (pinned by pgTAP test 09), so change both together. The chat header menu is real: View Profile opens `/network/{id}`; Report User calls the `report_user` RPC through `ReportUserDialog`/`src/utils/userReports.ts` (reasons mirror the DB CHECK, pinned by a unit test); Clear Chat calls `clear_conversation_history` and the UI hides messages older than the per-user marker (`src/utils/conversationClear.ts`). The "Discussing: … View Listing →" bar links to `/listings/{id}` only when the tagged id is a well-formed UUID (`listingHref`); the id comes from the `/messages` query string, so anything else shows the context without a link. The "Inquiry Context" card inside a message bubble links the same way (`parseListingTag` + `listingHref`); there the id is another broker's message text. `GlobalNotification` is a deliberate stub (messages have no recipient column to scope a global feed).
- **Storage:** objects live under `{auth.uid()}/…` in every bucket and RLS enforces that folder. `avatars`, `covers`, `listing-images` are public (images render by URL); `kyc-documents` is private. Avatar/cover uploads go through `src/utils/profileImages.ts`.

## Privacy model (enforced in the database)

- **Trust columns:** `verified`, `is_verified`, `kyc_status` and `auth_id` on `profiles` are writable only by `service_role`/`postgres` (trigger). Clients may only reset `kyc_status` to `'pending'`. No admin review flow exists, so nobody becomes verified yet; build it server-side with the service-role key.
- **`requirements.privacy_level`:** `Standard` (or NULL) is fully visible. Anything else is **masked** for non-owners in `requirements_feed`: `funding_status`, `purchase_purpose`, `preferred_localities`, `client_profile`, `details` return NULL. Add any new client-identifying column to the view's mask list.
- **Chat creation:** both users onboarded (`profiles.onboarded`), no block either way, and 20 new conversations per caller per rolling 24h (constant in the RPC). Blocks (`user_blocks`) also stop new messages in existing chats. UI: block/unblock from the chat header menu and an unblock list on the profile page (`useBlocks`, `ConfirmDialog`, `BlockedBrokersPanel`); a blocked person must never be shown that they are blocked. Reopening an existing chat is always allowed.
- **Reports:** `user_reports` is RLS-on with no client grants; brokers file reports only through `report_user` (reason allow-list, details <= 1000, `other` needs details, the reporter must share the conversation they cite, one open report per reporter+reported+reason, 10 per rolling 24h). The reported broker is never told. **Nothing in the app reads reports yet**: review them as `service_role` or in the SQL editor (query in the migration header). Optional "also block" in the dialog uses the normal block path.
- **Clear chat:** a per-user hide, never a deletion. `conversation_clears` holds one server-time marker per (conversation, user), readable only by its owner and written only by `clear_conversation_history`. The other participant, and the messages themselves, are untouched. The marker is compared with `messages.created_at` (both server time); an unparsable value fails open (shows the message).
- **Storage deletes:** remove files through the Storage API. `DELETE FROM storage.objects` leaves the real file in the object store. Orphan cleanup: `scripts/cleanup-orphaned-avatars.mjs` (dry run by default; header documents usage and its service-role requirement).

## Migrations and database tests

- Migrations in `supabase/migrations/` are the source of truth and replay cleanly from empty. Add forward-only migrations and leave applied ones untouched. Each states its rollout notes in its header.
- **Which migrations production has is the owner's to say.** Treat all as unapplied until told.
- **Rollout order:** `20261103120300_requirements_base_select_owner_only` ships *after* the frontend that reads `requirements_feed`; before that, feeds show only the viewer's own requirements. It refuses to run if the view is missing. The opposite holds for `20261103120800_ai_usage_rate_limit`: apply it *before* the code that calls `consume_ai_quota()`, because the route fails closed (503) when the function is missing, which turns AI writing off. Apply `20261103120900_user_reports` and `20261103121000_clear_conversation_history` before (or with) the chat-menu frontend: until they exist, Report and Clear Chat show a generic retryable error (the app tolerates a missing `conversation_clears` table by showing nothing as cleared). They do not depend on each other.
- **Tests:** pgTAP in `supabase/tests/database/`, run with `supabase test db` (needs the local Supabase stack). Fixtures that start chats need users with `onboarded = true`. Write each new policy/RPC test so it fails before the migration and passes after.
- **Hard to see in review:** RLS cannot hide single columns (use a view); a SECURITY DEFINER view is intended for `requirements_feed`; Storage upsert needs the owner SELECT policy as well as INSERT/UPDATE.

## Commands beyond AGENTS.md

- `npm run lint` is not clean (15 errors, 20 warnings, mostly `no-explicit-any`); the CI ratchet holds that line.
- `npm test` runs unit tests (`*.test.ts` beside the code, `scripts/*.test.mjs`) with Node's built-in runner and native TypeScript stripping; it needs Node >= 22.6. Tests import relatively with the `.ts` extension (`@/` aliases do not resolve) and the code under test sticks to erasable TypeScript (no enums, namespaces or parameter properties). Mocks stand in for Supabase, so SQL behaviour is covered only by the pgTAP suites.
- `chatErrors.test.ts` holds the database's exact error strings; it fails if the app mapper drifts from them, and pgTAP 09 fails if the database drifts.
- **CI** (`.github/workflows/ci.yml`) runs `tsc`, a lint ratchet, `npm test` and `npm run build`, plus a database job that replays every migration on a local Supabase stack and runs the pgTAP suites. The ratchet fails only if lint errors/warnings exceed `.github/lint-baseline.json`; when you reduce them, lower those numbers in the same PR. Require the "CI passed" check in branch protection (a GitHub setting, not code).

## UI direction

Institutional, understated, trustworthy: Midnight Slate + Champagne Gold (tokens in `globals.css`), dark by default, glass only where it aids clarity. Mobile-first with safe-area insets. Clip horizontal overflow with `overflow-x-clip`, not `overflow-x-hidden`: `hidden` on a wrapper makes it a scroll container and silently breaks `position: sticky`. The root layout and `GlobalLayout` clip this way, so pages cannot scroll sideways and sticky bars (Listings filter bar, listing-detail contact card) stick. Build loading/empty/error states with the Skeleton components, and surface failures as toasts.

**Fixed elements.** The desktop sidebar, the phone tab bar and overlays are `position: fixed`. Never put a `transform`, `filter`, `backdrop-filter`, `perspective` or `contain` on an ancestor of one: that ancestor becomes the containing block and the element stops being fixed (it scrolls with the page, and a phone tab bar ends up off-screen on tall pages). `src/app/template.tsx` wraps the whole shell, so it animates opacity only. Animate rise or blur inside GlobalLayout's `<main>` instead.

**Decoration that overhangs.** Absolutely positioned decoration with negative offsets (`bottom-[-10%]`, `right-[-10%]`) adds scrollable overflow: the root glows once made every page scroll 10% past its content. Keep such decoration in its own `absolute inset-0 overflow-hidden pointer-events-none` layer (`overflow-hidden` is fine there because it holds no content); see the glows in `src/app/layout.tsx`.

**Phone tab bar.** It covers the bottom 100px plus the safe area, and `GlobalLayout`'s `<main>` reserves that space. A full-height screen must end above it, as Messages does with `h-[calc(100dvh_-_100px_-_env(safe-area-inset-bottom))] md:h-[100dvh]`; otherwise the bar covers the screen's bottom controls (it covered the chat composer).

## Known gaps

- `requirements.broker_id` references `auth.users` in migrations, yet the code embeds `profiles!requirements_broker_id_fkey`. Confirm the live FK before touching either. The same embeds through `requirements_feed` are unverified against PostgREST.
- `MarketSphere` reads the legacy `listings.location` column that new listings never fill, so the globe shows demo data.
- `ChatArea`'s empty state claims an "end-to-end encrypted channel", which is false for a Supabase-backed chat: reword it.
- `GlobalLayout`'s `<main>` is a flex item with the default `min-width: auto`, so any `nowrap` or unbreakable content in a page widens it past the viewport (`overflow-x-clip` hides that, so it shows up as controls pushed off-screen, not as a scrollbar). `min-w-0` on the ancestors between the content and `<main>` does not help: intrinsic minimum widths propagate through them. The Messages screen is protected by `w-0 min-w-full` on its wrapper (zero intrinsic width, still fills the screen) plus `[overflow-wrap:anywhere]` on message text, with tests in the browser suite for unbroken text, URLs and long previews. Other pages are not: measured at 768px wide, `<main>` should be 480px but is 593px on `/dashboard`, 655px on `/network` and 584px on `/network/[id]`. The root fix is `min-w-0` on `<main>`, which would change those layouts (everything else was unchanged in a before/after layout diff), so review them visually first.
- The listing-tag message format (`__TAG_LISTING:id|title|price|location__`, written in the Messages page, parsed by `src/utils/listingTag.ts`) is fragile: a `|` in the title or price shifts the fields (wrong title/price on the card), and an `_` in the location stops the tag matching so the raw text shows. Listing titles are free text, so this can happen to real listings. A sturdier encoding needs a backward-compatible parser for stored messages.
- Submitted reports are not reviewed anywhere in the app (no admin UI).
- `QuickActionsPanel` (`src/components/dashboard/`) is unused.
- Profile page: a failed avatar/cover upload is silent. 6 `alert()` calls remain in the app: 4 on the profile page, 1 in `PropertyCard` (PDF failure) and 1 placeholder in the upgrade page.
- `src/utils/supabase/client.ts` logs debug lines; no `capacitor.config` is committed (native builds are not reproducible); `fix_blue.py`/`fix_emerald.py` are one-off scripts.

## Working with the owner

- Answer every development task with: what you understood, files to inspect, risk level, implementation plan, files you expect to change, a confirmation request before major edits, and final test commands (`npm run lint`, `npx tsc --noEmit`, `npm run build`).
- Fix security blockers before new features.
- Use heavy Claude sessions for security audits, migrations, multi-file refactors and performance work; copywriting and strategy go elsewhere.
