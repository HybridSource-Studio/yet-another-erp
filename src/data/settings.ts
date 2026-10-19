// Settings and reference data: the workspace, tax rates, locations and the chart of accounts.
// Reads only for now; editing them is phase 1 work (see docs/plan.md).

import type { ErpDatabase } from "./db";
import type { AccountMap } from "./posting";
import type { Account, AccountRole, Id, Location, TaxRate } from "./schema";
import { byName, live, liveList } from "./shared";

export class MissingAccountError extends Error {
  constructor(role: AccountRole) {
    super(`No account is set up for "${role}". Check the chart of accounts.`);
    this.name = "MissingAccountError";
  }
}

const ROLES: readonly AccountRole[] = [
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
];

export class Settings {
  constructor(private readonly db: ErpDatabase) {}

  async taxRates(): Promise<TaxRate[]> {
    const all = liveList(await this.db.taxRates.orderBy("_sort").toArray());
    return all.filter((t) => !t.archived);
  }

  async taxRate(id: Id): Promise<TaxRate | undefined> {
    return live(await this.db.taxRates.get(id));
  }

  async locations(): Promise<Location[]> {
    const all = liveList(await this.db.locations.toArray());
    return all.filter((l) => !l.archived).sort(byName);
  }

  /** The location stock moves to and from when a document names none: the first one made. */
  async defaultLocation(): Promise<Location> {
    const all = liveList(await this.db.locations.toArray()).filter((l) => !l.archived);
    const first = all.sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (!first) throw new Error("No stock location is set up.");
    return first;
  }

  /** The chart of accounts, by code. */
  async accounts(): Promise<Account[]> {
    return liveList(await this.db.accounts.orderBy("_sort").toArray());
  }

  /** The account holding each role. Throws if any role has none. */
  async accountMap(): Promise<AccountMap> {
    const accounts = await this.accounts();
    const map: Partial<AccountMap> = {};
    for (const role of ROLES) {
      const holders = accounts.filter((a) => a.role === role);
      const account = holders[0];
      if (!account) throw new MissingAccountError(role);
      if (holders.length > 1) {
        throw new Error(
          `More than one account is set up for "${role}". Check the chart of accounts.`,
        );
      }
      map[role] = account.id;
    }
    return map as AccountMap;
  }
}
