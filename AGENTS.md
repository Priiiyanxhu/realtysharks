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

- Next.js 16 proxy route protection
- Storage bucket owner-folder RLS
- Profiles/listings schema reconciliation
- Aadhaar, email and phone moved to profiles_private
- profiles_public safe view
- Chat RLS migration prepared
- MarketSphere viewport and reduced-motion optimization

## Current priorities

1. Apply and verify chat RLS
2. Fix realtime message subscriptions
3. Fix GlobalNotification schema mismatch
4. Resolve migration replay/reset ordering
5. Implement real search and filters
6. Reduce lint debt
7. Closed-beta workflow testing

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
- npm run build

## Workflow

- Inspect before editing.
- Produce a plan for security-sensitive work.
- Work on a dedicated branch.
- Make focused changes only.
- Include files changed, tests, risks and migration application instructions.
