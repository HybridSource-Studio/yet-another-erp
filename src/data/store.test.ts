import { expect, test } from "vitest";
import { LedgerError, openStore } from "./index";
import { freshStore } from "./test-helpers";
import { DEFAULT_ACCOUNTS } from "./schema";

test("the first run sets up a workspace, tax rate, location and chart of accounts", async () => {
  const store = await freshStore();
  const ws = await store.workspace();
  expect(ws.currency).toBe("USD");
  expect(await store.settings.taxRates()).toHaveLength(1);
  expect((await store.settings.defaultLocation()).name).toBe("Main");
  expect(await store.settings.accounts()).toHaveLength(DEFAULT_ACCOUNTS.length);
  expect(Object.keys(await store.settings.accountMap())).toHaveLength(11);
  // Setting up isn't the user's work, so no backup is due yet.
  expect(await store.changesSinceExport()).toBe(0);
});

test("reopening keeps the same workspace and doesn't seed twice", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const first = await freshStore(name);
  const id = first.workspaceId;
  first.close();
  const again = await openStore({ name });
  expect(again.workspaceId).toBe(id);
  expect(await again.settings.accounts()).toHaveLength(DEFAULT_ACCOUNTS.length);
  again.close();
});

test("writes count toward the next backup reminder", async () => {
  const store = await freshStore();
  await store.parties.create({ name: "Acme" });
  expect(await store.changesSinceExport()).toBe(1);
});

test("ledger tables can't be written through the ordinary write path", async () => {
  const store = await freshStore();
  // Reach the Writer the way a careless repository would.
  const writer = (store.parties as unknown as { writer: { create: (...a: unknown[]) => unknown } })
    .writer;
  await expect(async () => writer.create("journal", {})).rejects.toThrow(LedgerError);
});
