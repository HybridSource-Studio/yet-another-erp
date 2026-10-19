// For tests only: stores on fresh in-memory databases, closed and deleted after each test.

import { afterEach } from "vitest";
import { deleteStore, openStore, type Store } from "./index";

const opened: { store: Store; name: string }[] = [];

export async function freshStore(name = `test-${crypto.randomUUID()}`): Promise<Store> {
  const store = await openStore({ name });
  opened.push({ store, name });
  return store;
}

afterEach(async () => {
  for (const { store, name } of opened.splice(0)) {
    store.close();
    await deleteStore(name);
  }
});
