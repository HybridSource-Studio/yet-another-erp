// Posting: what a confirmed document writes to the ledgers. Pure functions from a document and
// its context to journal lines and stock moves, so every rule is unit-testable without a
// database. Documents.confirm() writes the result in the same transaction as the confirmation.
//
// Adding a document type's posting: write a Poster here, add it to POSTERS, and test it in
// posting.test.ts. Each entry must balance; the Writer refuses one that doesn't.

import { combineJournalLines, signedLine } from "./ledger";
import { lineAmount } from "./money";
import type {
  AccountRole,
  DocumentType,
  Id,
  Item,
  JournalLine,
  Milli,
  Minor,
  TradeDocument,
} from "./schema";
import { documentTotals } from "./totals";

export type AccountMap = Record<AccountRole, Id>;

export interface PostingContext {
  accounts: AccountMap;
  /** The items the document's lines refer to. */
  items: ReadonlyMap<Id, Item>;
  /** Where stock moves: the document's location, or the default one. */
  locationId: Id;
}

export interface PlannedMove {
  itemId: Id;
  locationId: Id;
  quantity: Milli;
  unitCost: Minor;
}

export interface Posting {
  journal: JournalLine[];
  stockMoves: PlannedMove[];
}

export type Poster = (doc: TradeDocument, context: PostingContext) => Posting;

/** Quotes and orders are promises, not transactions: confirming one numbers it and posts nothing. */
export const NON_POSTING_TYPES: readonly DocumentType[] = ["quote", "salesOrder", "purchaseOrder"];

/**
 * An invoice: the customer owes the total; sales and tax collected are credited; stock items
 * leave the location, moving their cost from inventory to cost of sales.
 */
export function postInvoice(doc: TradeDocument, context: PostingContext): Posting {
  const { accounts, items, locationId } = context;
  const totals = documentTotals(doc.lines);
  const lines: JournalLine[] = [
    signedLine(accounts.receivables, totals.total),
    signedLine(accounts.sales, -totals.net),
    signedLine(accounts.taxCollected, -totals.tax),
  ];
  const stockMoves: PlannedMove[] = [];
  let cost = 0;
  for (const line of doc.lines) {
    const item = line.itemId ? items.get(line.itemId) : undefined;
    if (!item || item.kind !== "stock") continue;
    const unitCost = item.costPrice ?? 0;
    stockMoves.push({ itemId: item.id, locationId, quantity: -line.quantity, unitCost });
    cost += lineAmount(line.quantity, unitCost);
  }
  lines.push(signedLine(accounts.costOfSales, cost), signedLine(accounts.inventory, -cost));
  return { journal: combineJournalLines(lines), stockMoves };
}

/** The document types that post, and how. A type in neither list can't be confirmed yet. */
export const POSTERS: Partial<Record<DocumentType, Poster>> = {
  invoice: postInvoice,
};

export function canConfirm(type: DocumentType): boolean {
  return NON_POSTING_TYPES.includes(type) || POSTERS[type] !== undefined;
}
