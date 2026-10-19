import { expect, test } from "vitest";
import { checkJournalLines, signedLine } from "./ledger";
import { canConfirm, postInvoice, type AccountMap, type PostingContext } from "./posting";
import type { DocumentLine, Item, TradeDocument } from "./schema";

const accounts = Object.fromEntries(
  [
    "cash",
    "receivables",
    "inventory",
    "taxPaid",
    "payables",
    "taxCollected",
    "equity",
    "sales",
    "costOfSales",
    "purchases",
    "stockAdjustments",
  ].map((role) => [role, role]),
) as AccountMap;

const base = { workspaceId: "w", createdAt: 0, updatedAt: 0, deletedAt: null, fieldClocks: {} };

const widget: Item = {
  ...base,
  id: "widget",
  sku: "W-1",
  name: "Widget",
  kind: "stock",
  unit: "pcs",
  salePrice: 1000,
  costPrice: 400,
  taxRateId: null,
  reorderPoint: null,
  archived: false,
};
const consulting: Item = { ...widget, id: "consulting", kind: "service", costPrice: 5000 };

const line = (over: Partial<DocumentLine>): DocumentLine => ({
  itemId: null,
  description: "x",
  quantity: 1000,
  unitPrice: 1000,
  discount: 0,
  taxRateId: "vat",
  taxRate: 2000,
  ...over,
});

const invoice = (lines: DocumentLine[]): TradeDocument => ({
  ...base,
  id: "inv",
  type: "invoice",
  status: "confirmed",
  number: "INV-000001",
  partyId: "p",
  issueDate: "2026-10-18",
  dueDate: null,
  locationId: null,
  reference: "",
  notes: "",
  lines,
  sourceId: null,
});

const context: PostingContext = {
  accounts,
  items: new Map([
    [widget.id, widget],
    [consulting.id, consulting],
  ]),
  locationId: "main",
};

test("an invoice debits receivables and credits sales and tax", () => {
  const posting = postInvoice(invoice([line({ quantity: 3000 })]), context);
  expect(posting.journal).toEqual([
    signedLine("receivables", 3600),
    signedLine("sales", -3000),
    signedLine("taxCollected", -600),
  ]);
  expect(posting.stockMoves).toEqual([]);
  checkJournalLines(posting.journal);
});

test("stock items leave the location at cost; services don't move stock", () => {
  const posting = postInvoice(
    invoice([
      line({ itemId: "widget", quantity: 2000 }),
      line({ itemId: "consulting", quantity: 1000 }),
    ]),
    context,
  );
  expect(posting.stockMoves).toEqual([
    { itemId: "widget", locationId: "main", quantity: -2000, unitCost: 400 },
  ]);
  expect(posting.journal).toContainEqual(signedLine("costOfSales", 800));
  expect(posting.journal).toContainEqual(signedLine("inventory", -800));
  checkJournalLines(posting.journal);
});

test("a return line on an invoice still balances", () => {
  const posting = postInvoice(
    invoice([
      line({ itemId: "widget", quantity: 2000 }),
      line({ itemId: "widget", quantity: -1000 }),
    ]),
    context,
  );
  checkJournalLines(posting.journal);
  expect(posting.stockMoves.map((m) => m.quantity)).toEqual([-2000, 1000]);
});

test("only types with posting rules, or none to post, can be confirmed", () => {
  expect(canConfirm("invoice")).toBe(true);
  expect(canConfirm("quote")).toBe(true);
  expect(canConfirm("purchaseOrder")).toBe(true);
  expect(canConfirm("bill")).toBe(false);
  expect(canConfirm("creditNote")).toBe(false);
});
