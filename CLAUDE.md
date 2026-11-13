@AGENTS.md

# Realtysharks

Mobile-first B2B real-estate network for Indian brokers, channel partners, developers, consultants and agents: post **listings** and buyer **requirements**, match them, chat directly. A premium professional network, not a consumer portal. AGENTS.md (imported above) holds the security rules, required checks, workflow and priorities; this file holds the invariants and points to the detail.

## Invariants

Hold these on every change. The browser queries Postgres directly, so **RLS is the access control**: ask of every new query, "what can any logged-in broker do with this?"

- **Other brokers' data** is read through views (`profiles_public`, `requirements_feed`); private fields live in owner-only `profiles_private`.
- **Server identity** comes from `getVerifiedUserId()`. On the server, `getSession()` only decodes a cookie that a client can forge.
- **Trust** is `profiles.verified`, writable only by the service role. Show a "Verified" badge only for `isVerifiedBroker(profile)`.
- **Chat is plain text** in Postgres under RLS, not encrypted. UI copy claims only what the system enforces (`src/utils/securityClaims.test.ts` guards it).
- **Blocking and reporting stay invisible** to the other broker: a blocked person never learns they are blocked, and a reported broker is never told.

## Conventions

- **Unit tests** (`*.test.ts` beside the code, run by `npm test`) import relatively with the `.ts` extension, and the code under test uses erasable TypeScript only (no enums, namespaces or parameter properties): Node strips types natively and `@/` aliases do not resolve. Mocks stand in for Supabase, so only the pgTAP suites cover SQL behaviour.
- **Lint ratchet:** when you reduce lint errors or warnings, lower `.github/lint-baseline.json` in the same change.

## Read before you change

- **Database access (queries, RLS, RPCs), privacy, chat, AI, storage or migrations:** [`docs/backend.md`](docs/backend.md).
- **Pages, layout, routing, 404/500 screens or user-facing copy:** [`docs/frontend.md`](docs/frontend.md).
- **Picking up work, or something looks broken:** [`docs/known-gaps.md`](docs/known-gaps.md) lists what is broken, unbuilt or undecided.

## Working with the owner

- Answer every development task with: what you understood, files to inspect, risk level, implementation plan, files you expect to change, a confirmation request before major edits, and final test commands (`npm run lint`, `npx tsc --noEmit`, `npm run build`).
- Fix security blockers before new features.
- Use heavy Claude sessions for security audits, migrations, multi-file refactors and performance work; copywriting and strategy go elsewhere.
