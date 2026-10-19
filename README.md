# Yet Another ERP

A simple, local-first ERP for small businesses: customers and suppliers, items and stock, quotes, orders, invoices and bills, and double-entry books that keep themselves. **No sign-up, no subscription, no server.** Your data stays in your browser, on your device. "Yet Another ERP" is a working name.

A HybridSource house project, licensed under the Fair Core License ([FCL-1.0-ALv2](LICENSE.md)).

**Status: phase 0, skeleton.** The data layer, its rules and its tests are in place, along with screens for customers and suppliers, items and the chart of accounts. Everything else has a place in the app and an issue to build it. Read [docs/plan.md](docs/plan.md) for what we're building and why, then pick an issue.

## Why another ERP?

Most ERPs are SaaS products first: logins, seats, plans, upsells, your data on someone else's servers. This one keeps the useful core (documents that can't be quietly edited, a stock ledger, books that always balance) and leaves out everything that only exists to run a subscription. The full list is in [docs/plan.md](docs/plan.md#what-no-saas-means).

## Run it

Needs Node 22.12 or later.

```sh
npm install
npm run dev        # http://localhost:5192
```

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Development server with hot reload                                   |
| `npm test`          | Data-layer unit tests (Vitest, in-memory IndexedDB)                  |
| `npm run e2e`       | Builds the app and runs the browser tests (Playwright)               |
| `npm run lint`      | ESLint and Prettier check                                            |
| `npm run typecheck` | TypeScript                                                           |
| `npm run build`     | Static build in `dist/`, which runs from any path on any static host |

CI runs lint, typecheck, unit and browser tests on every pull request. The first time you run the browser tests, install Chromium with `npx playwright install chromium`.

## What's in it

| Module                  | Status                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Customers and suppliers | List, add, edit, delete (refused once they have documents)                                |
| Items                   | List, add, edit, archive. SKUs unique; stock on hand derived from the stock ledger        |
| Documents               | Data layer: drafts, confirm (numbering and posting in one transaction), cancel (reversal) |
| Invoices                | Post to the journal and stock ledger on confirm. No editor screen yet                     |
| Chart of accounts       | Seeded on first run, read-only list                                                       |
| Everything else         | A page in the navigation and an issue on GitHub                                           |

## Your data

Everything is stored in the browser (IndexedDB) on the device you use. Nothing is sent anywhere: there are no analytics, no third-party scripts, and a browser test fails if the app makes a request to any other host. Backup to a file and restore are the first phase of work ([plan](docs/plan.md#roadmap)); until they land, treat this as a demo and don't keep real books in it.

## How the code is organised

```
src/
  config.ts       the product name (the only place it appears)
  data/           the data layer: no UI, no React
    schema.ts       record types, tables, fields, first-run defaults
    write.ts        the single write path: clock stamps, tombstones, ledger rules
    money.ts        integer money, quantities and rates; exact rounding
    totals.ts       document totals, derived from lines
    posting.ts      what each confirmed document writes to the ledgers (pure)
    ledger.ts       balanced-entry checks, reversals, stock levels, balances
    documents.ts    the draft / confirm / cancel lifecycle
    parties.ts      customers and suppliers
    items.ts        products and services
    settings.ts     workspace, tax rates, locations, chart of accounts
    merge.ts        per-field last-write-wins merge (for merging backups)
    hlc.ts, ids.ts  hybrid logical clock, UUIDv7 ids
    migrations.ts   schema migrations, shared by stored data and backup files
    db.ts           IndexedDB layout (Dexie)
    store.ts        opens the database, seeds first-run data, assembles the API
  app/            the React UI; reaches data only through src/data
    shell/          the frame: sidebar, top bar, command palette (Ctrl+K), nav model, theme
    components/     building blocks: Icon (inline SVG), PageHeader, Card, StatCard, Badge, EmptyState
    pages/          one file per screen
    styles/         design tokens (light and dark), base, shell, components, tables and forms
e2e/              browser tests
docs/
  plan.md         goals, what "no SaaS" means, principles, data model, roadmap, risks
  architecture.md how the parts fit together
```

The rules every change follows are in [CLAUDE.md](CLAUDE.md) (other AI tools: [AGENTS.md](AGENTS.md)). ESLint enforces the boundary between `app/` and `data/`. How to contribute is in [CONTRIBUTING.md](CONTRIBUTING.md).
