// The storage engine. This is the only file that defines the IndexedDB layout; UI code never
// imports it (ESLint enforces that). The database name carries no product name on purpose.

import Dexie, { type Table } from "dexie";
import type { Stored, TableName } from "./schema";

export const DEFAULT_DB_NAME = "erp";

export interface MetaRow {
  key: string;
  value: unknown;
}

export class ErpDatabase extends Dexie {
  meta!: Table<MetaRow, string>;
  workspaces!: Table<Stored<"workspaces">, string>;
  taxRates!: Table<Stored<"taxRates">, string>;
  locations!: Table<Stored<"locations">, string>;
  accounts!: Table<Stored<"accounts">, string>;
  parties!: Table<Stored<"parties">, string>;
  items!: Table<Stored<"items">, string>;
  documents!: Table<Stored<"documents">, string>;
  payments!: Table<Stored<"payments">, string>;
  stockMoves!: Table<Stored<"stockMoves">, string>;
  journal!: Table<Stored<"journal">, string>;

  constructor(name: string) {
    super(name);
    // Index layout only. Record shapes are versioned separately by SCHEMA_VERSION (schema.ts).
    // "_sort" and "_words" are absent on deleted records, so deleted records drop out of those
    // indexes and lists and search skip them for free. Never edit a version once released:
    // add a new this.version(n) instead.
    this.version(1).stores({
      meta: "key",
      workspaces: "id",
      taxRates: "id, _sort",
      locations: "id, _sort",
      accounts: "id, _sort, role",
      parties: "id, _sort, *_words",
      items: "id, _sort, sku, *_words",
      documents: "id, type, [type+status], partyId, issueDate, *_words",
      payments: "id, partyId, date",
      stockMoves: "id, itemId, locationId, sourceId, date",
      journal: "id, sourceId, date",
    });
  }

  tableFor<T extends TableName>(table: T): Table<Stored<T>, string> {
    return this.table(table) as Table<Stored<T>, string>;
  }

  async getMeta<V>(key: string): Promise<V | undefined> {
    return (await this.meta.get(key))?.value as V | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.meta.put({ key, value });
  }
}
