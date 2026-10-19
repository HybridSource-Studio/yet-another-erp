import { expect, test } from "vitest";
import { NotFoundError, ValidationError } from "./index";
import { freshStore } from "./test-helpers";

test("a party is a customer unless said otherwise", async () => {
  const store = await freshStore();
  const p = await store.parties.create({ name: "  Acme Ltd ", email: "ap@acme.test" });
  expect(p).toMatchObject({ name: "Acme Ltd", isCustomer: true, isSupplier: false });
  expect(await store.parties.get(p.id)).toEqual(p);
});

test("listing filters by role and sorts by name", async () => {
  const store = await freshStore();
  await store.parties.create({ name: "zeta", isCustomer: true });
  await store.parties.create({ name: "Alpha", isSupplier: true });
  await store.parties.create({ name: "beta", isCustomer: true, isSupplier: true });
  expect((await store.parties.list()).map((p) => p.name)).toEqual(["Alpha", "beta", "zeta"]);
  expect((await store.parties.list("supplier")).map((p) => p.name)).toEqual(["Alpha", "beta"]);
  expect((await store.parties.list("customer")).map((p) => p.name)).toEqual(["beta", "zeta"]);
});

test("input is validated", async () => {
  const store = await freshStore();
  await expect(store.parties.create({ name: " " })).rejects.toThrow(ValidationError);
  await expect(store.parties.create({ name: "A", email: "nope" })).rejects.toThrow("Email");
  await expect(
    store.parties.create({ name: "A", isCustomer: false, isSupplier: false }),
  ).rejects.toThrow("customer, supplier");
  await expect(store.parties.create({ name: "A", paymentTermsDays: 1.5 })).rejects.toThrow(
    "Payment terms",
  );
});

test("an update changes only what it names", async () => {
  const store = await freshStore();
  const p = await store.parties.create({ name: "Acme", phone: "123" });
  const updated = await store.parties.update(p.id, { isSupplier: true });
  expect(updated).toMatchObject({ name: "Acme", phone: "123", isCustomer: true, isSupplier: true });
  expect(updated.fieldClocks.isSupplier! > p.fieldClocks.isSupplier!).toBe(true);
  expect(updated.fieldClocks.name).toBe(p.fieldClocks.name);
  await expect(store.parties.update("missing", { name: "x" })).rejects.toThrow(NotFoundError);
  await expect(store.parties.update(p.id, { name: "" })).rejects.toThrow(
    new ValidationError("Name is required."),
  );
});

test("a party with documents can't be deleted; one without can", async () => {
  const store = await freshStore();
  const used = await store.parties.create({ name: "Used" });
  const unused = await store.parties.create({ name: "Unused" });
  await store.documents.createDraft({ type: "quote", partyId: used.id, issueDate: "2026-10-18" });
  await expect(store.parties.remove(used.id)).rejects.toThrow("can't be deleted");
  await store.parties.remove(unused.id);
  expect(await store.parties.get(unused.id)).toBeUndefined();
  expect((await store.parties.list()).map((p) => p.name)).toEqual(["Used"]);
});
