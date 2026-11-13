# Contributing

Thanks for helping. Realtysharks is a small project with one maintainer, so focused changes are the easiest to review.

## Before you start

- **Read [`AGENTS.md`](AGENTS.md).** Its security rules, required checks and workflow apply to every change, whoever (or whatever) writes it.
- **Read the doc for the area you touch:** [`CLAUDE.md`](CLAUDE.md) has the invariants and points to [`docs/backend.md`](docs/backend.md) and [`docs/frontend.md`](docs/frontend.md).
- **Check [`docs/known-gaps.md`](docs/known-gaps.md)** to see whether the problem is already known.
- **For a larger change, open an issue first** so we can agree on the approach before you write it.
- **Found a vulnerability?** Report it privately as described in [`SECURITY.md`](SECURITY.md), not in an issue.

## Making a change

1. Fork the repository and branch from `main`.
2. Set it up as described in the [README](README.md).
3. Keep the change to one concern, and add or update tests with it: unit tests sit beside the code as `*.test.ts`, database tests are pgTAP suites in `supabase/tests/database/`.
4. Run the required checks from [`AGENTS.md`](AGENTS.md) before you open the pull request. CI runs them too, plus the lint ratchet and the database suites.
5. Open a pull request and fill in the template.

## Database changes

Add a new forward-only migration in `supabase/migrations/`; edit no migration that already exists. State its rollout notes in its header (what it needs first, what breaks if it is applied out of order). Production SQL is reviewed and applied by hand by the maintainer.

## Licence

Realtysharks is licensed under the [GNU Affero General Public License v3.0](LICENSE). By contributing, you agree that your contribution is licensed under the same terms.

## Conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
