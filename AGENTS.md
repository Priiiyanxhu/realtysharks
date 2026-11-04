<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Realtysharks Agent Instructions

## Project

Realtysharks is a mobile-first B2B real-estate networking app built with
Next.js 16.2.9, React 19, TypeScript, Supabase, Tailwind v4,
Framer Motion, Three.js/R3F, Gemini and Capacitor.

## Current phase

Security hardening before closed beta.

## Completed

- Next.js 16 proxy route protection (JWT verified with getClaims)
- Password recovery via /auth/callback
- Storage owner-folder RLS on every bucket, incl. no anonymous avatars listing
- Profiles/listings schema reconciliation; migrations replay from empty
- Aadhaar, email and phone in profiles_private; profiles_public safe view
- Self-verification blocked (trust-column trigger)
- Requirements: anon access removed; privacy_level masking via requirements_feed
- Chat RLS, RPC-only conversation creation, onboarding gate, daily cap, blocks, mapped chat error messages, block/unblock UI
- Per-conversation realtime subscriptions; GlobalNotification stubbed on purpose
- Orphaned avatar detection + cleanup script; old avatar deleted on upload
- Per-user and global rate limit on /api/ai-autowrite (consume_ai_quota RPC, fails closed), with the message shown beside the AI button
- Sideways overflow clipped and the root glows' blank scroll tail removed (pages end at their content); sticky bars stick; fixed sidebar and phone tab bar are truly fixed (opacity-only template); chat screen ends above the phone tab bar
- CI workflow (typecheck, lint ratchet, unit tests, build, migration replay + pgTAP)
- MarketSphere viewport and reduced-motion optimization
- Chat header menu: View Profile, Report User (`report_user` RPC, private, deduped and capped) and Clear Chat (per-user hide) are real; placeholders removed
- Chat header "View Listing" bar is a real link (id validated); tagged-listing titles can no longer push chat controls off-screen on phones
- Chat "Inquiry Context" card in message bubbles is a real link (same id validation); its long values wrap inside the bubble
- Long or unbroken chat messages (pasted URLs, 200-character strings, long previews) no longer push the header menu, Send button or list time stamps off the screen
- `<main>` has `min-w-0`: no page can be stretched past the screen by long unbreakable content; the `/dashboard`, `/network` and `/network/[id]` tablet overflows are gone (broker profile header now stacks below 1024px)
- Dashboard stats card wraps: both buttons stay inside the card and clickable from 320 to 1600px (stacked full width on phones and tablets, beside the stats from about 1280px)
- Network Feed items no longer clip their timestamp: the title/time row wraps and the timestamp can break onto two lines in a narrow column (13 widths, 320 to 1600px)
- Network Feed requirement items link to the requirement's broker (`/network/{broker id}?tab=requirements`, opens the Requirements tab) instead of a "Broker Not Found" page; an item with no broker_id shows without a link
- Dashboard columns: the Sphere and Network Feed stack full width until 1280px (feed text was 71px wide at 1024px and the Sphere title clipped); the Sphere canvas now covers its card at any width (14 widths, 320 to 1600px)
- Empty-chat copy no longer claims end-to-end encryption (it is false: chat is plain text under RLS); a unit test guards against the claim returning
- Listing contact card no longer says "Strictly Confidential" (it says "Private • In-App Messaging Only")
- Verified badges are real: shown only when `profiles.verified` is true (`isVerifiedBroker`), never from a RERA number, a match score or a default; the profile hint and PDF flyer fallbacks no longer say "Verified". Until admin KYC review (priority 4) sets `verified`, no broker shows a badge

## Current priorities

1. Owner reviews and applies the pending migrations in order (see CLAUDE.md, "Migrations and database tests")
2. Verify PostgREST embeds through requirements_feed on staging before the owner-only requirements migration
3. Admin review of `user_reports` (server-side, service_role; nothing reads them yet), and consider a block/report entry point on broker profile pages
4. Admin KYC review (server-side, service_role) so brokers can become verified
5. Blunt account farming (email confirmation or other signup friction): per-user limits, including AI writing, can be sidestepped with new accounts; the global AI cap is only the cost backstop
6. Confirm the live requirements foreign key matches the code (see CLAUDE.md, "Known gaps")
7. Real search and filters (listings feed is wired; verify the rest)
8. Confirm the CI database job is green on GitHub, require "CI passed" in branch protection, and reduce lint debt (lower .github/lint-baseline.json as it falls)
9. Closed-beta workflow testing

## Security rules

- Never expose secrets or print environment values.
- Never use service_role in browser code.
- Never apply migrations to production automatically.
- Never create broad RLS policies using USING (true) for private data.
- Never allow cross-user KYC or private contact access.
- Never modify message bodies belonging to another user.
- All production SQL must be reviewed and manually applied by the owner.

## Required checks

- npx tsc --noEmit
- npm test
- npm run build

## Workflow

- Inspect before editing.
- Produce a plan for security-sensitive work.
- Work on a dedicated branch.
- Make focused changes only.
- Include files changed, tests, risks and migration application instructions.
