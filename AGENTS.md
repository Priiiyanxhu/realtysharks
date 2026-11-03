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
- CI workflow (typecheck, lint ratchet, unit tests, build, migration replay + pgTAP)
- MarketSphere viewport and reduced-motion optimization

## Current priorities

1. Owner reviews and applies the pending migrations in order (see CLAUDE.md, "Migrations and database tests")
2. Verify PostgREST embeds through requirements_feed on staging before the owner-only requirements migration
3. Fix `position: fixed` being pinned to the page, not the viewport (CLAUDE.md, "Known gaps"): desktop sidebar scrolls away, phone tab bar is off-screen on tall pages
4. Replace placeholder chat menu actions (View Profile, Report User, Clear Chat) and consider a block entry point on broker profile pages
5. Per-user rate limit on /api/ai-autowrite
6. Admin KYC review (server-side, service_role) so brokers can become verified
7. Confirm the live requirements foreign key matches the code (see CLAUDE.md, "Known gaps")
8. Real search and filters (listings feed is wired; verify the rest)
9. Confirm the CI database job is green on GitHub, require "CI passed" in branch protection, and reduce lint debt (lower .github/lint-baseline.json as it falls)
10. Closed-beta workflow testing

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
