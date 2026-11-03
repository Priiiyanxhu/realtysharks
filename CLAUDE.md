@AGENTS.md

# Realtysharks

Mobile-first B2B real-estate network for Indian brokers, channel partners, developers, consultants and agents: post **listings** and buyer **requirements**, match them, chat directly, trust verified peers. A premium professional network, not a consumer portal. AGENTS.md (imported above) holds the security rules, required checks, workflow, completed work and priorities. This file holds architecture, conventions and gotchas. *Verified against the repo 2026-11-03.*

## Architecture

- **Supabase is the backend.** The browser queries Postgres directly, so RLS is the access control. Reason about every new query as "what can any logged-in broker do with this?".
- **Browser client:** `@/utils/supabase/client`. `src/lib/supabase.ts`, `src/lib/gemini.ts` and `@supabase/auth-helpers-nextjs` are unused.
- **Server identity:** `getVerifiedUserId()` in `src/utils/supabase/server.ts` (`getClaims()` verifies the JWT). Server code treats `getSession()` as untrusted: it only decodes the cookie, and a forged cookie passes it.
- **Route gate:** `src/proxy.ts` (Next 16 name for middleware). `/api/*` returns 401 and pages redirect to `/login`. `ProtectedRoute`/`GlobalLayout` are client-side extras. `/update-password` stays protected on purpose: `/auth/callback` exchanges the emailed code for a session first.
- **AI:** `/api/ai-autowrite` (Gemini, server-only key). It verifies the caller and caps prompt size; there is no per-user rate limit yet.
- **Profiles:** `profiles.id` = `auth.users.id`, and `auth_id` mirrors it (the app queries by `auth_id`). Other brokers' profiles are read from the `profiles_public` view. Email, phone and Aadhaar live in owner-only `profiles_private`.
- **Requirements:** read other brokers' requirements from `requirements_feed`; read your own from the table, which is owner-only once the rollout step below is applied. Details under "Privacy model".
- **Chat:** start conversations with the `get_or_create_direct_conversation` RPC (INSERT on `conversations`/`conversation_participants` is revoked) and mark read with `mark_conversation_messages_read`. Messages are sent by direct insert under RLS. Realtime subscribes per conversation. Rejections become user-facing copy in `src/utils/chatErrors.ts`, which matches the RPC's error messages (pinned by pgTAP test 09), so change both together. `GlobalNotification` is a deliberate stub (messages have no recipient column to scope a global feed).
- **Storage:** objects live under `{auth.uid()}/…` in every bucket and RLS enforces that folder. `avatars`, `covers`, `listing-images` are public (images render by URL); `kyc-documents` is private. Avatar/cover uploads go through `src/utils/profileImages.ts`.

## Privacy model (enforced in the database)

- **Trust columns:** `verified`, `is_verified`, `kyc_status` and `auth_id` on `profiles` are writable only by `service_role`/`postgres` (trigger). Clients may only reset `kyc_status` to `'pending'`. No admin review flow exists, so nobody becomes verified yet; build it server-side with the service-role key.
- **`requirements.privacy_level`:** `Standard` (or NULL) is fully visible. Anything else is **masked** for non-owners in `requirements_feed`: `funding_status`, `purchase_purpose`, `preferred_localities`, `client_profile`, `details` return NULL. Add any new client-identifying column to the view's mask list.
- **Chat creation:** both users onboarded (`profiles.onboarded`), no block either way, and 20 new conversations per caller per rolling 24h (constant in the RPC). Blocks (`user_blocks`) also stop new messages in existing chats. UI: block/unblock from the chat header menu and an unblock list on the profile page (`useBlocks`, `ConfirmDialog`, `BlockedBrokersPanel`); a blocked person must never be shown that they are blocked. Reopening an existing chat is always allowed.
- **Storage deletes:** remove files through the Storage API. `DELETE FROM storage.objects` leaves the real file in the object store. Orphan cleanup: `scripts/cleanup-orphaned-avatars.mjs` (dry run by default; header documents usage and its service-role requirement).

## Migrations and database tests

- Migrations in `supabase/migrations/` are the source of truth and replay cleanly from empty. Add forward-only migrations and leave applied ones untouched. Each states its rollout notes in its header.
- **Which migrations production has is the owner's to say.** Treat all as unapplied until told.
- **Rollout order:** `20261103120300_requirements_base_select_owner_only` ships *after* the frontend that reads `requirements_feed`; before that, feeds show only the viewer's own requirements. It refuses to run if the view is missing.
- **Tests:** pgTAP in `supabase/tests/database/`, run with `supabase test db` (needs the local Supabase stack). Fixtures that start chats need users with `onboarded = true`. Write each new policy/RPC test so it fails before the migration and passes after.
- **Hard to see in review:** RLS cannot hide single columns (use a view); a SECURITY DEFINER view is intended for `requirements_feed`; Storage upsert needs the owner SELECT policy as well as INSERT/UPDATE.

## Commands beyond AGENTS.md

- `npm run lint` is not clean (15 errors, 21 warnings, mostly `no-explicit-any`); the CI ratchet holds that line.
- `npm test` runs unit tests (`*.test.ts` beside the code, `scripts/*.test.mjs`) with Node's built-in runner and native TypeScript stripping; it needs Node >= 22.6. Tests import relatively with the `.ts` extension (`@/` aliases do not resolve) and the code under test sticks to erasable TypeScript (no enums, namespaces or parameter properties). Mocks stand in for Supabase, so SQL behaviour is covered only by the pgTAP suites.
- `chatErrors.test.ts` holds the database's exact error strings; it fails if the app mapper drifts from them, and pgTAP 09 fails if the database drifts.
- **CI** (`.github/workflows/ci.yml`) runs `tsc`, a lint ratchet, `npm test` and `npm run build`, plus a database job that replays every migration on a local Supabase stack and runs the pgTAP suites. The ratchet fails only if lint errors/warnings exceed `.github/lint-baseline.json`; when you reduce them, lower those numbers in the same PR. Require the "CI passed" check in branch protection (a GitHub setting, not code).

## UI direction

Institutional, understated, trustworthy: Midnight Slate + Champagne Gold (tokens in `globals.css`), dark by default, glass only where it aids clarity. Mobile-first with safe-area insets. Clip horizontal overflow with `overflow-x-clip`, not `overflow-x-hidden`: `hidden` on a wrapper makes it a scroll container and silently breaks `position: sticky`. The root layout clips decorative overhang this way, so pages cannot scroll sideways. Build loading/empty/error states with the Skeleton components, and surface failures as toasts.

## Known gaps

- `requirements.broker_id` references `auth.users` in migrations, yet the code embeds `profiles!requirements_broker_id_fkey`. Confirm the live FK before touching either. The same embeds through `requirements_feed` are unverified against PostgREST.
- `MarketSphere` reads the legacy `listings.location` column that new listings never fill, so the globe shows demo data.
- Chat header menu items View Profile, Report User and Clear Chat are placeholder `alert()`s (Block/Unblock is real).
- `src/components/layout/GlobalLayout.tsx:69` has `overflow-x-hidden` on the app shell, which makes it a scroll container, so `position: sticky` there never sticks (the Listings `FilterBar` scrolls away). The root layout already clips horizontally, so switching that class to `overflow-x-clip` should be safe; check the visual result before shipping, since the bar would start floating.
- Profile page: a failed avatar/cover upload is silent, and 9 `alert()` calls remain.
- `src/utils/supabase/client.ts` logs debug lines; no `capacitor.config` is committed (native builds are not reproducible); `fix_blue.py`/`fix_emerald.py` are one-off scripts.

## Working with the owner

- Answer every development task with: what you understood, files to inspect, risk level, implementation plan, files you expect to change, a confirmation request before major edits, and final test commands (`npm run lint`, `npx tsc --noEmit`, `npm run build`).
- Fix security blockers before new features.
- Use heavy Claude sessions for security audits, migrations, multi-file refactors and performance work; copywriting and strategy go elsewhere.
