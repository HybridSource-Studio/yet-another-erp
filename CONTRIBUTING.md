# Contributing

Thanks for helping. This is a HybridSource project, licensed under the Fair Core License ([FCL-1.0-ALv2](LICENSE.md)); contributions are made under the same licence.

## Getting started

You need Node 22.12 or later.

```sh
npm install
npm run dev        # http://localhost:5192
```

The commands and the code layout are in the [README](README.md). What we're building and why is in [docs/plan.md](docs/plan.md); how the parts fit together is in [docs/architecture.md](docs/architecture.md).

## Picking an issue

- Issues are grouped into milestones by phase, and labelled by module (`module:sales`, `module:inventory`...).
- `good first issue` ones are small and self-contained. `points:tier-1` to `points:tier-4` give a rough size, from a small fix to foundational work.
- Comment on an issue before you start so two people don't build the same thing. If an issue is unclear, ask there.
- Phase 1 (data safety) comes first: nobody should keep real books in the app before backup and restore work.

## Before you open a pull request

- Read [CLAUDE.md](CLAUDE.md). It holds the rules every change follows: no SaaS features, append-only ledgers, balanced entries, integer money. It's written for AI coding tools and people alike.
- Add tests with the change. Data-layer behaviour gets a unit test next to it (`src/data/*.test.ts`); posting rules get a pure test in `posting.test.ts`; a user-facing flow gets a browser test (`e2e/`). Tests select by role and label, so the UI stays accessible to screen readers and AI browser agents.
- A change to a record's shape needs a schema version bump, a migration and a fixture.
- If users would notice the change, add a line to [CHANGELOG.md](CHANGELOG.md) in plain words.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e`. CI runs them all on every pull request.

## Pull requests

One pull request per issue, small enough to review. Describe what changed and why, how you tested it, and anything a reviewer should look at closely. Scope is set by [docs/plan.md](docs/plan.md); its "out of scope" list waits.

## Using AI coding tools

Welcome. Claude Code reads [CLAUDE.md](CLAUDE.md); other tools read [AGENTS.md](AGENTS.md), which points to the same rules.
