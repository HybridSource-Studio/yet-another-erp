# Architecture

How the parts fit together. The product plan and data model are in [plan.md](plan.md); the rules every change follows are in [CLAUDE.md](../CLAUDE.md).

## Layers

```
src/app  (React)  ──>  src/data/index.ts  ──>  repositories  ──>  Writer  ──>  Dexie / IndexedDB
                                              (parties, items,    (write.ts)
                                               documents, ...)
                                                    │
                                                    └── pure rules: money, totals, posting, ledger
```

- **`src/app`** renders pages and reads through `useLive`, which re-runs a query whenever the data it read changes. It never imports Dexie, `db.ts` or `write.ts` (ESLint enforces this).
- **Repositories** (`parties.ts`, `items.ts`, `documents.ts`, `settings.ts`) validate input, enforce what may be changed or deleted, and read. They write only through the Writer.
- **The Writer** (`write.ts`) is the single write path. It stamps every changed field with the hybrid logical clock, derives local index fields, counts changes for backup reminders, refuses to edit or delete ledger records, and refuses an unbalanced journal entry.
- **Pure rules** (`money.ts`, `totals.ts`, `posting.ts`, `ledger.ts`) have no database. They are where most bugs would hide, so they carry most of the tests.

## Confirming a document

`Documents.confirm(id)` runs in one IndexedDB transaction:

1. Checks the document is a draft, has lines, and that its type can be confirmed (`canConfirm`).
2. Refreshes each line's tax rate from the current rate, freezing it from now on.
3. Takes the next number for the type (`INV-000042`). This runs inside the transaction, so two tabs can't take the same number.
4. Marks the document confirmed.
5. Runs the type's poster (`POSTERS` in `posting.ts`), a pure function that returns journal lines and stock moves, and appends them through the Writer.

If any step throws, nothing is written. `cancel(id)` is the mirror image: for every ledger record the document posted, it appends one with the opposite sign, pointing back at the original through `reversesId`.

## Adding a document type's posting

1. Write a `Poster` in `posting.ts`: `(document, context) => { journal, stockMoves }`. Build lines with `signedLine`, tidy them with `combineJournalLines`.
2. Add it to `POSTERS`. `canConfirm` picks it up, and confirming that type starts working.
3. Test it in `posting.test.ts` (balances, stock direction, edge cases such as negative lines) and add one lifecycle test in `documents.test.ts`.

## Deriving instead of storing

| Shown to the user             | Derived from                 | Function                     |
| ----------------------------- | ---------------------------- | ---------------------------- |
| A document's totals and taxes | its lines                    | `documentTotals`             |
| Stock on hand                 | stock moves                  | `stockLevels`, `Items.stock` |
| Account balances, reports     | journal entries              | `accountBalances`            |
| Next document number          | the highest confirmed number | `Documents.nextNumber`       |

If something can be derived, derive it. A stored copy of a derived value is a second source of truth, and the two will disagree.

## Why every record has field clocks

There is no server, so the only way two devices share data is a backup from one being merged into the other. `merge.ts` merges two copies of a record field by field: the later clock stamp wins. Ledger records are never edited, so they merge by simply being added. Deletes are tombstones (`deletedAt`), so a delete merges like any other edit. The same rules would let a self-hosted sync relay be added later without changing the data layer.

## Storage

- `db.ts` defines the IndexedDB indexes. Never edit a released `this.version(n)`; add a new one.
- `SCHEMA_VERSION` in `schema.ts` versions record shapes. A shape change needs a migration in `migrations.ts`, which upgrades both stored data and old backup files.
- Fields starting with `_` (`_words`, `_sort`) are derived on this device for indexes and are never exported.
- `meta` holds this device's bookkeeping (device id, clock, change count) and is never exported.
