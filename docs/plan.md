# Plan: a simple ERP with none of the SaaS

"Yet Another ERP" is a working name. This is the plan the skeleton was built from: what we're making, the rules that keep it simple and robust, the data model, and the order of work. The issues are cut from the roadmap below.

## The goal

A small, plain ERP for a business of one to twenty people: what you sell, what you buy, what's in stock, who owes whom, and the books that follow from all of it. It should open in a second, need no training, and never hold your data hostage.

Most ERPs are SaaS products first and business tools second. Strip out everything that exists to run a subscription business, and what's left is surprisingly small: a few lists, one document editor, two ledgers, and some reports.

## What "no SaaS" means

Removed, on purpose, and not coming back as a paid tier:

| Typical SaaS ERP                                   | Here                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Sign-up, login, password resets                    | None. Open the page and start.                                       |
| Your data on the vendor's servers                  | Your data in your browser, on your device. No server of ours exists. |
| Monthly fee per seat, plans, feature gates, trials | Free. Every feature is in the one build.                             |
| "Upgrade to unlock" prompts, upsells, ads          | None.                                                                |
| Telemetry, analytics, tracking pixels              | None. The app makes no requests to anyone (a browser test checks).   |
| Export locked behind a plan, proprietary formats   | Full backup to one documented JSON file, plus CSV, at any time.      |
| Vendor-run integrations marketplace                | A documented file format and a read-only MCP server instead.         |
| Multi-tenant admin, billing, usage metering        | Nothing to administer.                                               |
| Works only online                                  | Works offline once loaded; installable as an app.                    |

What we keep from the good ERPs: double-entry books that always balance, a stock ledger, numbered documents that can't be quietly edited after the fact, and reports an accountant will accept.

**More than one device or person?** Without a server, sharing works the way files do: export a backup on one device and "restore and merge" it on another. Every record carries per-field clocks, so merges are safe in any order. A self-hostable sync relay that _you_ run is possible later, and the data layer is ready for it, but it is not part of this plan.

## Principles

1. **Enter things once; derive the rest.** Totals come from lines. Stock on hand comes from stock moves. Balances come from journal entries. Nothing derived is stored, so nothing can drift.
2. **Ledgers, not balances.** Stock moves and journal entries are append-only. Confirming a document writes to them; nothing else edits them.
3. **Mistakes are reversed, never erased.** A confirmed document can't be edited or deleted. Cancelling writes reversing entries, and a corrected copy starts as a new draft. Every number in a report can be traced to the document that caused it.
4. **Exact money.** Amounts are integers in minor units, quantities are integer thousandths, rates are basis points. No floats are stored, and rounding happens in one place (`money.ts`).
5. **Atomic.** A confirmation numbers the document and writes all of its postings in one transaction, or does nothing.
6. **Local and yours.** Static site, IndexedDB, offline. Backups are a documented format. No third-party scripts.
7. **Small on purpose.** Each module does the common case well. Anything country-specific or industry-specific is a setting or a later add-on, not a fork in the core.

## How it's built

A static web app (Vite, React, TypeScript) over IndexedDB (Dexie), the same stack as the HybridSource CRM. Code is split into `src/data` (no UI, all rules, unit-tested) and `src/app` (React, reaches data only through `src/data`). See [architecture.md](architecture.md) for the write path, posting and the ledger rules.

## Data model

All records share a base: a client-made id (UUIDv7), `workspaceId`, `createdAt`, `updatedAt`, a `deletedAt` tombstone, and a clock stamp per field. Types live in [`src/data/schema.ts`](../src/data/schema.ts).

| Table        | What it holds                                                                              | Kind      |
| ------------ | ------------------------------------------------------------------------------------------ | --------- |
| `workspaces` | The business: name, legal name, address, tax id, currency, financial year start            | settings  |
| `taxRates`   | Named rates in basis points                                                                | settings  |
| `locations`  | Where stock is kept                                                                        | settings  |
| `accounts`   | Chart of accounts. Each role (receivables, sales, inventory...) belongs to exactly one     | settings  |
| `parties`    | Customers and suppliers, one record per business, flagged as either or both                | master    |
| `items`      | Products (counted) and services (not counted): SKU, unit, prices, tax rate, reorder point  | master    |
| `documents`  | Quotes, sales orders, invoices, credit notes, purchase orders, bills: one shape, own lines | documents |
| `payments`   | Money in or out, allocated to documents                                                    | documents |
| `stockMoves` | Signed quantity of one item at one location, with unit cost and source                     | ledger    |
| `journal`    | Balanced double-entry entries with their source                                            | ledger    |

### The document lifecycle

```
draft --confirm--> confirmed --cancel--> cancelled
  |                (numbered, posted,     (postings reversed)
  +--delete         never edited)
```

Quotes and orders are promises, not transactions: confirming one numbers it and posts nothing. A document records the one it was converted from (`sourceId`), so quote, order and invoice form a chain you can follow.

### What each document posts

| Document         | Journal                                                                                     | Stock                             | Status  |
| ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------- | ------- |
| Invoice          | Dr receivables (total); Cr sales (net), tax collected (tax); Dr cost of sales, Cr inventory | Out of the location, at cost      | built   |
| Credit note      | The invoice's lines, reversed                                                               | Back into the location, at cost   | phase 2 |
| Payment received | Dr cash; Cr receivables                                                                     | None                              | phase 2 |
| Bill             | Dr inventory (stock lines) or purchases (other lines), tax paid; Cr payables                | Into the location, at bill cost   | phase 3 |
| Payment made     | Dr payables; Cr cash                                                                        | None                              | phase 3 |
| Stock adjustment | Stock adjustments against inventory, at cost                                                | In or out                         | phase 4 |
| Stock transfer   | None                                                                                        | Out of one location, into another | phase 4 |
| Manual entry     | Whatever the user enters, if it balances                                                    | None                              | phase 5 |

Cost of sales uses the item's cost price for now. Phase 4 replaces it with a moving average derived from receipts.

## Roadmap

Each phase is a milestone on GitHub, and each issue in it is small enough for one pull request. Phases can overlap once phase 1's data-safety work has landed.

**Phase 0: skeleton (v0.1, done).** Repo, conventions, CI. Data layer: ids, clocks, merge, the write path with ledger rules, money maths, document totals, invoice posting, confirm and cancel. Screens for customers and suppliers, items and the chart of accounts, and a place in the navigation for every other module. 54 unit tests, 4 browser tests.

**Phase 1: foundations and data safety.** Settings (business details, currency, financial year), tax rates and locations screens. Backup to a file and restore (replace), with a JSON Schema. Ask the browser for persistent storage, say honestly whether it was granted, explain on first run where the data lives, and remind people to back up. CSV import for parties and items. _Nobody should put real books into this before backup works, which is why it comes first._

**Phase 2: sales.** One document editor shared by every type: line grid, item lookup, keyboard-friendly. Quotes to orders to invoices. Credit notes. Payments received and allocation. Printable documents through the browser's print-to-PDF (no PDF library, no server).

**Phase 3: purchasing.** Purchase orders, bills and their posting, payments made.

**Phase 4: inventory.** The stock page (on hand by item and location), adjustments and stocktakes, transfers, moving-average cost, reorder report, stock valuation.

**Phase 5: accounting.** Edit the chart of accounts, journal view, manual entries, trial balance, profit and loss, balance sheet, receivables and payables aging, locking a closed period.

**Phase 6: ready for 1.0.** Installable and offline (PWA), landing page, merging a backup from another device, a performance page with a large generated dataset, a read-only MCP server over backups, an accessibility pass.

## Out of scope for now

Don't build these, but don't design them out either:

- Accounts, logins, roles and permissions (there is no server to log in to)
- Hosted or vendor-run sync. A self-hosted relay may come after 1.0.
- Multiple currencies on documents, and exchange-rate revaluation
- Multiple companies in one workspace
- Payroll, manufacturing (bills of materials, work orders), point of sale, projects and timesheets
- Bank feeds, e-commerce connectors, e-invoicing networks, country tax filings
- Recurring invoices, email sending, file attachments, custom fields

## Risks and open questions

- **Browsers can evict local data.** Clearing site data, low disk space, and Safari's rules for sites that aren't installed can all lose it. Mitigation: phase 1 puts backup, persistent storage and reminders before anything else, and the first-run message says plainly where data lives.
- **Document numbers across devices.** Numbers are one more than the highest on this device. Two devices confirming offline and then merging could both issue INV-000042. Options: a device prefix, numbering only on one "main" device, or renumbering drafts on merge. Needs a decision before phase 6's merge lands.
- **Tax rules vary.** Per-line rounding, tax-exclusive prices and one rate per line cover most small businesses. Tax-inclusive prices and per-document rounding should become workspace settings, not forks.
- **Costing.** Moving average is simple and widely accepted. FIFO is out of scope; it would need lot tracking in the stock ledger.
- **Ledger growth.** Balances are sums over every entry. That is fine for years of a small business's data, but the phase 6 performance page should prove it, and period closing could add opening-balance entries if it isn't.
- **Accountant trust.** Reports must match what an accountant expects. Phase 5 should be checked by someone who keeps books for a living.
- **Merging ledgers twice.** Ledger records get random ids, so if two devices each cancel the same document offline and then merge, both reversals survive and the books double-count. Before merge lands: give postings and reversals deterministic ids (from the document id and the entry they reverse), and give first-run records (accounts, the default tax rate and location) deterministic ids so two devices' charts of accounts merge into one.
