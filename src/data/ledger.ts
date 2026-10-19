// Ledger rules and the reads derived from ledgers. Stock on hand and account balances are never
// stored: they are sums over stock moves and journal entries, so they can't drift.

import type { Id, JournalEntry, JournalLine, Milli, Minor, StockMove } from "./schema";

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Throws unless the lines form a valid, balanced journal entry. */
export function checkJournalLines(lines: readonly JournalLine[]): void {
  if (lines.length < 2) throw new LedgerError("A journal entry needs at least two lines.");
  let debits = 0;
  let credits = 0;
  for (const { debit, credit } of lines) {
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) {
      throw new LedgerError("Journal amounts must be whole numbers of minor units.");
    }
    if (debit < 0 || credit < 0) throw new LedgerError("Journal amounts cannot be negative.");
    if ((debit === 0) === (credit === 0)) {
      throw new LedgerError("Each journal line is either a debit or a credit.");
    }
    debits += debit;
    credits += credit;
  }
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
    throw new LedgerError("Journal entry is too large.");
  }
  if (debits !== credits) {
    throw new LedgerError(`Journal entry doesn't balance: debits ${debits}, credits ${credits}.`);
  }
}

/** A line for a signed amount: positive is a debit, negative a credit. */
export function signedLine(accountId: Id, amount: Minor): JournalLine {
  return amount >= 0
    ? { accountId, debit: amount, credit: 0 }
    : { accountId, debit: 0, credit: -amount };
}

/**
 * Nets lines per account and drops the ones that come to zero, keeping accounts in order of
 * first appearance. Posting builds lines freely and tidies them with this.
 */
export function combineJournalLines(lines: readonly JournalLine[]): JournalLine[] {
  const net = new Map<Id, Minor>();
  for (const line of lines) {
    net.set(line.accountId, (net.get(line.accountId) ?? 0) + line.debit - line.credit);
  }
  return [...net]
    .filter(([, amount]) => amount !== 0)
    .map(([accountId, amount]) => signedLine(accountId, amount));
}

/** The lines that undo an entry. */
export function reverseJournalLines(lines: readonly JournalLine[]): JournalLine[] {
  return lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit }));
}

/** Throws unless a stock move is a non-zero whole quantity at a whole-number cost. */
export function checkStockMove(move: Pick<StockMove, "quantity" | "unitCost">): void {
  if (!Number.isSafeInteger(move.quantity) || move.quantity === 0) {
    throw new LedgerError("A stock move needs a non-zero whole quantity.");
  }
  if (!Number.isSafeInteger(move.unitCost) || move.unitCost < 0) {
    throw new LedgerError("A stock move's cost must be a whole number of minor units.");
  }
}

export interface Balance {
  debit: Minor;
  credit: Minor;
}

/** Total debits and credits per account over some entries: the basis of every financial report. */
export function accountBalances(entries: readonly Pick<JournalEntry, "lines">[]): Map<Id, Balance> {
  const out = new Map<Id, Balance>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const b = out.get(line.accountId) ?? { debit: 0, credit: 0 };
      out.set(line.accountId, { debit: b.debit + line.debit, credit: b.credit + line.credit });
    }
  }
  return out;
}

export interface StockLevel {
  itemId: Id;
  locationId: Id;
  quantity: Milli;
}

/** Stock on hand per item and location, leaving out the pairs that come to zero. */
export function stockLevels(
  moves: readonly Pick<StockMove, "itemId" | "locationId" | "quantity">[],
): StockLevel[] {
  const totals = new Map<string, StockLevel>();
  for (const m of moves) {
    const key = `${m.itemId}|${m.locationId}`;
    const level = totals.get(key) ?? { itemId: m.itemId, locationId: m.locationId, quantity: 0 };
    totals.set(key, { ...level, quantity: level.quantity + m.quantity });
  }
  return [...totals.values()].filter((l) => l.quantity !== 0);
}
