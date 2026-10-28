import { expect, test } from "vitest";
import { accountBalances } from "./ledger";
import { DocumentStateError, ValidationError, type Store } from "./index";
import { freshStore } from "./test-helpers";

async function setUp(store: Store) {
  const customer = await store.parties.create({ name: "Acme" });
  const widget = await store.items.create({ name: "Widget", salePrice: 1000, costPrice: 400 });
  const [noTax] = await store.settings.taxRates();
  return { customer, widget, noTax: noTax! };
}

function balanceOf(balances: ReturnType<typeof accountBalances>, id: string): number {
  const b = balances.get(id);
  return b ? b.debit - b.credit : 0;
}

test("a draft takes the item's name and the tax rate's value", async () => {
  const store = await freshStore();
  const { customer, widget, noTax } = await setUp(store);
  const draft = await store.documents.createDraft({
    type: "invoice",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: widget.id, quantity: 2000, unitPrice: 1000, taxRateId: noTax.id }],
  });
  expect(draft).toMatchObject({ status: "draft", number: null });
  expect(draft.lines[0]).toMatchObject({ description: "Widget", taxRate: 0 });
  expect(store.documents.totals(draft).total).toBe(2000);
});

test("drafts are validated", async () => {
  const store = await freshStore();
  const { customer } = await setUp(store);
  const input = { type: "invoice" as const, partyId: customer.id, issueDate: "2026-10-18" };
  await expect(store.documents.createDraft({ ...input, partyId: "nope" })).rejects.toThrow(
    "customer or supplier",
  );
  await expect(store.documents.createDraft({ ...input, issueDate: "18/10/2026" })).rejects.toThrow(
    ValidationError,
  );
  await expect(
    store.documents.createDraft({
      ...input,
      lines: [{ quantity: 0, unitPrice: 1, description: "x" }],
    }),
  ).rejects.toThrow("quantity");
  await expect(
    store.documents.createDraft({ ...input, lines: [{ quantity: 1000, unitPrice: 1 }] }),
  ).rejects.toThrow("item or a description");
  const empty = await store.documents.createDraft(input);
  await expect(store.documents.confirm(empty.id)).rejects.toThrow("at least one line");
});

test("confirming numbers the invoice and posts it in one go", async () => {
  const store = await freshStore();
  const { customer, widget } = await setUp(store);
  const accounts = await store.settings.accountMap();
  const draft = await store.documents.createDraft({
    type: "invoice",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: widget.id, quantity: 3000, unitPrice: 1000 }],
  });
  const confirmed = await store.documents.confirm(draft.id);
  expect(confirmed).toMatchObject({ status: "confirmed", number: "INV-000001" });

  const balances = accountBalances(await store.ledger("journal"));
  expect(balanceOf(balances, accounts.receivables)).toBe(3000);
  expect(balanceOf(balances, accounts.sales)).toBe(-3000);
  expect(balanceOf(balances, accounts.costOfSales)).toBe(1200);
  expect(balanceOf(balances, accounts.inventory)).toBe(-1200);
  expect(await store.items.onHand(widget.id)).toBe(-3000);

  const second = await store.documents.createDraft({ ...draft, lines: draft.lines });
  expect((await store.documents.confirm(second.id)).number).toBe("INV-000002");
});

test("confirmed documents can't be edited or deleted, only cancelled", async () => {
  const store = await freshStore();
  const { customer, widget } = await setUp(store);
  const draft = await store.documents.createDraft({
    type: "invoice",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: widget.id, quantity: 1000, unitPrice: 1000 }],
  });
  await store.documents.confirm(draft.id);
  await expect(store.documents.updateDraft(draft.id, { notes: "x" })).rejects.toThrow(
    DocumentStateError,
  );
  await expect(store.documents.removeDraft(draft.id)).rejects.toThrow(DocumentStateError);
  await expect(store.documents.confirm(draft.id)).rejects.toThrow(DocumentStateError);
});

test("cancelling reverses every posting, so balances return to zero", async () => {
  const store = await freshStore();
  const { customer, widget } = await setUp(store);
  const draft = await store.documents.createDraft({
    type: "invoice",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: widget.id, quantity: 2000, unitPrice: 1000 }],
  });
  await store.documents.confirm(draft.id);
  const cancelled = await store.documents.cancel(draft.id);
  expect(cancelled.status).toBe("cancelled");
  for (const b of accountBalances(await store.ledger("journal")).values()) {
    expect(b.debit - b.credit).toBe(0);
  }
  expect(await store.items.onHand(widget.id)).toBe(0);
  // The original entries are still there: the ledger shows what happened, then the reversal.
  expect(await store.ledger("journal")).toHaveLength(2);
  await expect(store.documents.cancel(draft.id)).rejects.toThrow(DocumentStateError);
});

test("quotes are numbered on confirm and post nothing", async () => {
  const store = await freshStore();
  const { customer, widget } = await setUp(store);
  const quote = await store.documents.createDraft({
    type: "quote",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: widget.id, quantity: 1000, unitPrice: 1000 }],
  });
  expect((await store.documents.confirm(quote.id)).number).toBe("QUO-000001");
  expect(await store.ledger("journal")).toEqual([]);
  expect(await store.ledger("stockMoves")).toEqual([]);
});

test("types without posting rules yet refuse to confirm, writing nothing", async () => {
  const store = await freshStore();
  const { customer } = await setUp(store);
  const note = await store.documents.createDraft({
    type: "creditNote",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ description: "Refund", quantity: 1000, unitPrice: 50000 }],
  });
  await expect(store.documents.confirm(note.id)).rejects.toThrow("isn't built yet");
  expect((await store.documents.get(note.id))?.status).toBe("draft");
});

test("a confirmed bill brings stock in and owes the supplier; cancelling undoes both", async () => {
  const store = await freshStore();
  const { widget } = await setUp(store);
  const supplier = await store.parties.create({ name: "Parts Ltd" });
  const accounts = await store.settings.accountMap();
  const draft = await store.documents.createDraft({
    type: "bill",
    partyId: supplier.id,
    issueDate: "2026-10-18",
    lines: [
      { itemId: widget.id, quantity: 5000, unitPrice: 400 },
      { description: "Delivery", quantity: 1000, unitPrice: 1500 },
    ],
  });
  const confirmed = await store.documents.confirm(draft.id);
  expect(confirmed).toMatchObject({ status: "confirmed", number: "BILL-000001" });

  const balances = accountBalances(await store.ledger("journal"));
  expect(balanceOf(balances, accounts.inventory)).toBe(2000);
  expect(balanceOf(balances, accounts.purchases)).toBe(1500);
  expect(balanceOf(balances, accounts.payables)).toBe(-3500);
  expect(await store.items.onHand(widget.id)).toBe(5000);
  expect(await store.ledger("stockMoves")).toMatchObject([{ quantity: 5000, unitCost: 400 }]);

  await store.documents.cancel(draft.id);
  for (const b of accountBalances(await store.ledger("journal")).values()) {
    expect(b.debit - b.credit).toBe(0);
  }
  expect(await store.items.onHand(widget.id)).toBe(0);
});

test("impossible dates are refused", async () => {
  const store = await freshStore();
  const { customer } = await setUp(store);
  await expect(
    store.documents.createDraft({ type: "quote", partyId: customer.id, issueDate: "2026-02-31" }),
  ).rejects.toThrow(ValidationError);
});

test("a draft whose item was deleted can still be edited, but not confirmed", async () => {
  const store = await freshStore();
  const { customer } = await setUp(store);
  const gadget = await store.items.create({ name: "Gadget" });
  const draft = await store.documents.createDraft({
    type: "invoice",
    partyId: customer.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: gadget.id, quantity: 1000, unitPrice: 100 }],
  });
  await store.items.remove(gadget.id);
  await expect(store.documents.updateDraft(draft.id, { notes: "Rush" })).resolves.toMatchObject({
    notes: "Rush",
  });
  await expect(store.documents.confirm(draft.id)).rejects.toThrow("has been deleted");
  expect((await store.documents.get(draft.id))?.status).toBe("draft");
  expect(await store.ledger("journal")).toEqual([]);
});

test("a draft can be edited and deleted", async () => {
  const store = await freshStore();
  const { customer } = await setUp(store);
  const draft = await store.documents.createDraft({
    type: "quote",
    partyId: customer.id,
    issueDate: "2026-10-18",
  });
  const edited = await store.documents.updateDraft(draft.id, {
    lines: [{ description: "Design work", quantity: 2500, unitPrice: 8000 }],
  });
  expect(store.documents.totals(edited).net).toBe(20000);
  await store.documents.removeDraft(draft.id);
  expect(await store.documents.list("quote")).toEqual([]);
});
