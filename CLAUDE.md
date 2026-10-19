# Yet Another ERP

A simple, local-first ERP with none of the SaaS. A HybridSource house project. GitHub: HybridSource-Studio/yet-another-erp (private). Licensed FCL-1.0-ALv2 (LICENSE.md). Don't make the repo public or change the licence without the HybridSource maintainers.

The plan, data model and roadmap are [docs/plan.md](docs/plan.md); how the parts fit is [docs/architecture.md](docs/architecture.md). Work in phase order; each issue is one pull request.

## Commands

- `npm run dev`: development server on http://localhost:5192
- `npm test`: data-layer unit tests; `npm run e2e`: Playwright against the production build (port 5193)
- `npm run lint`, `npm run typecheck`, `npm run build`

## No SaaS

The point of the project. Never add:

- Accounts, logins, licence keys, plan or seat checks, feature gates, trials, upsell prompts, or ads.
- Analytics, telemetry, error reporting services, or any runtime request to a third party (an e2e test checks). No third-party scripts, fonts or images. Never hard-code a domain.
- Anything that needs a server we run. The build is static files that work from any path on any host.

## Accounting and stock rules

- **Ledgers are append-only.** `stockMoves` and `journal` are written only by `Writer.append`, never updated or deleted. Corrections are reversing entries with `reversesId` set.
- **Every journal entry balances.** `Writer.append` refuses one that doesn't (`checkJournalLines`). Build lines with `signedLine` and tidy them with `combineJournalLines`.
- **Confirmed documents are never edited.** Only drafts change. Cancelling reverses postings; a correction is a new draft.
- **Confirm is atomic.** Numbering, the status change and every posting happen inside one `writer.transact`. Keep it that way.
- **Posting is pure.** A document type's posting is a `Poster` in `posting.ts`, unit-tested without a database. Register it in `POSTERS`.
- **Derive, don't store.** Totals come from lines (`totals.ts`), stock on hand from stock moves, balances from the journal. Before adding a field, ask whether it can be derived.

## Money

- Amounts are integers in minor units (`Minor`), quantities integer thousandths (`Milli`), rates basis points (`BasisPoints`). Never store a float.
- Multiply and round only with `money.ts` (`lineAmount`, `applyRate`, `mulDiv`, `allocate`). Rounding is half away from zero. Tax is rounded per line.
- Parse user input with `parseMoney` / `parseQuantity` / `parseRate`; format with `formatMoney` etc. Dividing for display is fine; never feed a displayed value back into storage.

## Rules that keep merging safe

- The product name lives in `src/config.ts` only. Never in identifiers, storage keys, database names or file formats.
- Every record has a client-generated id, `workspaceId`, a `deletedAt` tombstone (never hard deletes), and per-field clocks. All handled by the Writer.
- UI code never touches the storage engine. All data access goes through `src/data` (ESLint enforces it).

## Data layer conventions

- Every write goes through `Writer` in `src/data/write.ts`.
- Optional fields are `null`, never `undefined`, so exports round-trip exactly.
- Fields starting with `_` are local only (search words, sort keys), never exported. Deleted records drop them so they leave the indexes.
- Changing a record shape: bump `SCHEMA_VERSION`, add a migration in `migrations.ts`, and add a fixture test. Never delete a migration.
- Changing indexes: add a new `this.version(n)` in `db.ts`; never edit an existing one.
- Changing what `withLocalFields` derives: bump `LOCAL_FIELDS_VERSION` in `write.ts`.
- Errors thrown inside `writer.transact` reach callers unwrapped (the Writer undoes Dexie's wrapping). Never give an error class a name Dexie or IndexedDB already uses (`NotFoundError`, `DataError`, `ConstraintError`, `AbortError`...): Dexie converts those into its own types.
- Repositories validate and throw `ValidationError` with a message a person can act on. They decide what may be deleted: something with history (a party with documents, an item with stock moves) is refused or archived instead.
- Reads used in live queries (`useLive`) must not await a non-Dexie promise before their Dexie reads, or Dexie stops tracking the query.

## UI conventions

- Forms read values from the page on submit (`formText` in `components/forms.ts`), not from React state, so autofill and AI browser agents that set values directly still work.
- Every control has a visible or accessible label. Tests select by role and label, which keeps this honest.
- Plain words. Say "customers and suppliers", not "business partners"; "books", not "general ledger", unless an accountant would expect it.
- Colours, spacing, radii and shadows come from the tokens in `src/app/styles/tokens.css`, in both themes. Never write a raw colour in a component or another stylesheet.
- Icons are inline SVG from `components/Icon.tsx`, marked decorative; the text beside them carries the meaning. No icon fonts, no image icons.
- Every module is listed once, in `shell/nav.ts`. The sidebar, the breadcrumb and the command palette all read it; a new page is added there and in `App.tsx`.
- Pages are built from `PageHeader`, `Card`, `StatCard`, `Badge` and `EmptyState`. A list with nothing in it shows an `EmptyState` that says what the list is for and offers the first step.
- The theme and the sidebar's collapsed state are per-device preferences in localStorage, not in the data layer.

## Versions and the changelog

- The version lives in `package.json` only; the footer shows it.
- Each phase's last pull request bumps the minor version and adds a section at the top of `CHANGELOG.md`, written for users. 1.0.0 is the first release meant for real books.
