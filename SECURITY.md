# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/Priiiyanxhu/realtysharks/security/advisories/new)). Keep the details out of public issues, pull requests and discussions until a fix has shipped.

A useful report says:

- what an attacker can do, and as which user (signed out, any signed-in broker, a specific role);
- the steps or the request that shows it;
- which part is affected (a page, an API route, an RLS policy, an RPC, a storage bucket).

Reports are handled on a best-effort basis by the maintainer. You will get an acknowledgement on the advisory, and credit in it if you want it.

## Scope

In scope: this repository's code, including the Next.js app, the API routes, and the database schema, Row Level Security policies and RPCs in `supabase/migrations/`.

Out of scope: third-party services the app uses (Supabase, Google Gemini) and findings that need a compromised device or account.

## Supported versions

Only the `main` branch is supported. There are no released versions yet.

## How the app is secured

The browser talks to Postgres directly, so Row Level Security is the access control. [`CLAUDE.md`](CLAUDE.md) lists the invariants and [`docs/backend.md`](docs/backend.md) describes the access and privacy model, which helps when judging whether a behaviour is a vulnerability.
