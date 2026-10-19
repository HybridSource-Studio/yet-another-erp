import { expect, test } from "vitest";
import { ValidationError } from "./index";
import { freshStore } from "./test-helpers";

test("an item defaults to a stock item counted in pieces", async () => {
  const store = await freshStore();
  const item = await store.items.create({ name: "Widget", salePrice: 1000 });
  expect(item).toMatchObject({ kind: "stock", unit: "pcs", archived: false, sku: "" });
});

test("SKUs are unique, ignoring case", async () => {
  const store = await freshStore();
  const a = await store.items.create({ name: "A", sku: "W-1" });
  await expect(store.items.create({ name: "B", sku: "w-1" })).rejects.toThrow("already used by A");
  await expect(store.items.update(a.id, { sku: "W-1", name: "A2" })).resolves.toMatchObject({
    name: "A2",
  });
});

test("services have no reorder point; prices must be whole minor units", async () => {
  const store = await freshStore();
  const s = await store.items.create({ name: "Consulting", kind: "service", reorderPoint: 5000 });
  expect(s.reorderPoint).toBeNull();
  await expect(store.items.create({ name: "X", salePrice: 9.99 })).rejects.toThrow(ValidationError);
  await expect(store.items.create({ name: "X", taxRateId: "nope" })).rejects.toThrow("tax rate");
});

test("archived items leave the list but stay readable", async () => {
  const store = await freshStore();
  const item = await store.items.create({ name: "Old" });
  await store.items.update(item.id, { archived: true });
  expect(await store.items.list()).toEqual([]);
  expect(await store.items.list({ includeArchived: true })).toHaveLength(1);
});

test("an item that has moved stock can't be deleted", async () => {
  const store = await freshStore();
  const party = await store.parties.create({ name: "Acme" });
  const item = await store.items.create({ name: "Widget", costPrice: 100 });
  const doc = await store.documents.createDraft({
    type: "invoice",
    partyId: party.id,
    issueDate: "2026-10-18",
    lines: [{ itemId: item.id, quantity: 1000, unitPrice: 500 }],
  });
  await store.documents.confirm(doc.id);
  expect(await store.items.onHand(item.id)).toBe(-1000);
  await expect(store.items.remove(item.id)).rejects.toThrow("archive it instead");
  await expect(store.items.update(item.id, { kind: "service" })).rejects.toThrow("can't change");
});
