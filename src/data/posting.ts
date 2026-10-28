// Posting: what a confirmed document writes to the ledgers. Pure functions from a document and
// its context to journal lines and stock moves, so every rule is unit-testable without a
// database. Documents.confirm() writes the result in the same transaction as the confirmation.
//
// Adding a document type's posting: write a Poster here, add it to POSTERS, and test it in
// posting.test.ts. Each entry must balance; the Writer refuses one that doesn't.

import { combineJournalLines, signedLine } from "./ledger";
import { lineAmount, MILLI_PER_UNIT, mulDiv } from "./money";
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
import { documentTotals, lineTotals } from "./totals";

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

/**
 * A bill: the supplier is owed the total; tax paid is debited; stock items enter the location at
 * the price paid, debiting inventory; everything else (services, lines with no item) is purchases.
 */
export function postBill(doc: TradeDocument, context: PostingContext): Posting {
  const { accounts, items, locationId } = context;
  const totals = documentTotals(doc.lines);
  const lines: JournalLine[] = [
    signedLine(accounts.taxPaid, totals.tax),
    signedLine(accounts.payables, -totals.total),
  ];
  const stockMoves: PlannedMove[] = [];
  for (const line of doc.lines) {
    const { net } = lineTotals(line);
    const item = line.itemId ? items.get(line.itemId) : undefined;
    if (!item || item.kind !== "stock") {
      lines.push(signedLine(accounts.purchases, net));
      continue;
    }
    lines.push(signedLine(accounts.inventory, net));
    stockMoves.push({
      itemId: item.id,
      locationId,
      quantity: line.quantity,
      unitCost: unitCostOf(net, line.quantity),
    });
  }
  return { journal: combineJournalLines(lines), stockMoves };
}

/** What one unit cost, after discount: net / quantity, rounded. A return has both negative. */
function unitCostOf(net: Minor, quantity: Milli): Minor {
  return quantity < 0
    ? mulDiv(-net, MILLI_PER_UNIT, -quantity)
    : mulDiv(net, MILLI_PER_UNIT, quantity);
}

/** The document types that post, and how. A type in neither list can't be confirmed yet. */
export const POSTERS: Partial<Record<DocumentType, Poster>> = {
  invoice: postInvoice,
  bill: postBill,
};

export function canConfirm(type: DocumentType): boolean {
  return NON_POSTING_TYPES.includes(type) || POSTERS[type] !== undefined;
}
