# Realtysharks

Mobile-first B2B real-estate network for Indian brokers, channel partners, developers, consultants and agents: post listings and buyer requirements, match them, and chat directly. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 and Supabase (Postgres, Auth, Storage, Realtime), with Gemini for AI writing.

## Start here

- **Changing code?** Read [`AGENTS.md`](AGENTS.md) first: the security rules, required checks, workflow, what is done and the current priorities.
- **Touching data, auth, chat or privacy?** Read [`CLAUDE.md`](CLAUDE.md): the architecture, the privacy model enforced in the database, gotchas and known gaps. The browser queries Postgres directly, so Row Level Security is the access control.
- **Changing the database?** [`supabase/migrations/`](supabase/migrations) is the source of truth. Add a new forward-only migration; the owner reviews production SQL and applies it by hand.
- **Writing Next.js code?** Next 16 has breaking changes. The reference is `node_modules/next/dist/docs/`.

## Run it locally

You need Node 22.6 or newer (the unit tests run TypeScript natively) and Docker (for the local Supabase stack).

```bash
npm ci
npx supabase start     # empty local database with every migration replayed
npx supabase status    # prints the API URL and keys for the next step
npm run dev            # http://localhost:3000
```

Put these in `.env.local` (git-ignored):

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the app, and `npm run build` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the app, and `npm run build` (the anon / publishable key) |
| `GEMINI_API_KEY` | AI writing on the post-listing and post-requirement pages (server only) |

- **Building** needs the two public variables set. Any placeholder values pass, as in CI.
- **The local database starts empty.** Register an account (no email confirmation locally) and finish onboarding. Chat needs two onboarded accounts.
- **`/testbed`** is a component playground that exists only under `npm run dev`.
- **Scripts in `scripts/`** read their own variables, documented in each script's header. The service-role key belongs to those scripts alone.

## Check your work

The required checks are listed in [`AGENTS.md`](AGENTS.md). CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) adds two things you can run yourself:

- A lint ratchet against [`.github/lint-baseline.json`](.github/lint-baseline.json): lint is not clean, and the baseline falls as debt is paid.
- The database suites: `npx supabase test db supabase/tests/database` (pgTAP, needs the local stack running).

Known gaps, including unbuilt features and native (Capacitor) build setup, are tracked in [`CLAUDE.md`](CLAUDE.md).
