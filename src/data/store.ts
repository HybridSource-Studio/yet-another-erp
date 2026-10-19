// Opens the database and puts the data layer together. The app makes one Store at startup;
// tests make as many as they like, each with its own database name.

import Dexie, { liveQuery } from "dexie";
import { DEFAULT_DB_NAME, ErpDatabase } from "./db";
import { Documents } from "./documents";
import { Clock, type ClockState } from "./hlc";
import { randomDeviceId, uuidv7 } from "./ids";
import { Items } from "./items";
import { stripLocal } from "./merge";
import {
  META_CHANGES,
  META_CLOCK,
  META_DEVICE,
  META_LOCAL_FIELDS,
  META_SCHEMA,
  META_WORKSPACE,
} from "./meta";
import { migrateRecord, NewerDataError, type PlainRecord } from "./migrations";
import { Parties } from "./parties";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CURRENCY,
  DEFAULT_FISCAL_YEAR_START,
  DEFAULT_LOCATION,
  DEFAULT_TAX_RATES,
  SCHEMA_VERSION,
  TABLES,
  isLedgerTable,
  type Id,
  type RecordTypes,
  type TableName,
  type Workspace,
} from "./schema";
import { Settings } from "./settings";
import { LOCAL_FIELDS_VERSION, withLocalFields, Writer } from "./write";

export interface Subscription {
  unsubscribe(): void;
}

/** A query that re-runs whenever the data it read changes. */
export interface LiveQuery<T> {
  subscribe(observer: { next: (value: T) => void; error?: (error: unknown) => void }): Subscription;
}

export class Store {
  readonly settings: Settings;
  readonly parties: Parties;
  readonly items: Items;
  readonly documents: Documents;

  constructor(
    private readonly db: ErpDatabase,
    writer: Writer,
    readonly workspaceId: Id,
    readonly deviceId: string,
  ) {
    this.settings = new Settings(db);
    this.parties = new Parties(db, writer);
    this.items = new Items(db, writer);
    this.documents = new Documents(db, writer, this.settings);
  }

  /** Wraps any read made through this store so it re-runs when its data changes. */
  observe<T>(query: () => Promise<T>): LiveQuery<T> {
    return liveQuery(query);
  }

  async workspace(): Promise<Workspace> {
    const ws = await this.db.workspaces.get(this.workspaceId);
    if (!ws) throw new Error("Workspace missing");
    return stripLocal(ws);
  }

  /** Every journal entry and stock move, for reports and tests. Ledgers are never filtered here. */
  async ledger<T extends "journal" | "stockMoves">(table: T): Promise<RecordTypes[T][]> {
    const rows = await this.db.tableFor(table).toArray();
    return rows.map((r) => stripLocal(r) as RecordTypes[T]);
  }

  /** Writes since the last export; will drive backup reminders. */
  async changesSinceExport(): Promise<number> {
    return (await this.db.getMeta<number>(META_CHANGES)) ?? 0;
  }

  close(): void {
    this.db.close();
  }
}

export interface OpenOptions {
  /** Database name. The app uses the default; tests use their own. */
  name?: string;
}

export async function openStore(options: OpenOptions = {}): Promise<Store> {
  const db = new ErpDatabase(options.name ?? DEFAULT_DB_NAME);
  await db.open();
  await upgradeStoredData(db);

  const deviceId = await db.transaction("rw", db.meta, async () => {
    const existing = await db.getMeta<string>(META_DEVICE);
    if (existing) return existing;
    const id = randomDeviceId();
    await db.setMeta(META_DEVICE, id);
    return id;
  });

  const clock = new Clock(deviceId, await db.getMeta<ClockState>(META_CLOCK));
  const { id: workspaceId, created } = await ensureWorkspace(db, clock);
  // The starting records are not the user's work, so they don't call for a backup.
  if (created) await db.setMeta(META_CHANGES, 0);
  return new Store(db, new Writer(db, clock, workspaceId), workspaceId, deviceId);
}

/** Deletes a whole database. For tests and "erase everything". */
export async function deleteStore(name: string = DEFAULT_DB_NAME): Promise<void> {
  await Dexie.delete(name);
}

/** The first run creates the one workspace, a tax rate, a stock location and a chart of accounts. */
async function ensureWorkspace(
  db: ErpDatabase,
  clock: Clock,
): Promise<{ id: Id; created: boolean }> {
  const existing = await db.getMeta<Id>(META_WORKSPACE);
  if (existing) return { id: existing, created: false };

  const id = uuidv7();
  const writer = new Writer(db, clock, id);
  return writer.transact(async (tick) => {
    // Another tab may have got here first.
    const raced = await db.getMeta<Id>(META_WORKSPACE);
    if (raced) return { id: raced, created: false };
    const add = async <T extends TableName>(table: T, record: RecordTypes[T]) => {
      await db.tableFor(table).add(withLocalFields(table, record));
    };
    await add("workspaces", {
      ...writer.build(
        "workspaces",
        {
          name: "My business",
          legalName: "",
          address: "",
          taxId: "",
          currency: DEFAULT_CURRENCY,
          fiscalYearStart: DEFAULT_FISCAL_YEAR_START,
        },
        tick(),
      ),
      id,
      workspaceId: id,
    });
    for (const rate of DEFAULT_TAX_RATES) {
      await add("taxRates", writer.build("taxRates", { ...rate, archived: false }, tick()));
    }
    await add(
      "locations",
      writer.build("locations", { name: DEFAULT_LOCATION, archived: false }, tick()),
    );
    for (const account of DEFAULT_ACCOUNTS) {
      await add("accounts", writer.build("accounts", { ...account, archived: false }, tick()));
    }
    await db.setMeta(META_WORKSPACE, id);
    return { id, created: true };
  });
}

/**
 * Brings stored records up to SCHEMA_VERSION using the same migrations as old backup files, and
 * re-derives their local index fields when LOCAL_FIELDS_VERSION has changed.
 */
async function upgradeStoredData(db: ErpDatabase): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    const found = await db.getMeta<number>(META_SCHEMA);
    if (found === undefined) {
      await db.setMeta(META_SCHEMA, SCHEMA_VERSION);
      await db.setMeta(META_LOCAL_FIELDS, LOCAL_FIELDS_VERSION);
      return;
    }
    if (found > SCHEMA_VERSION) throw new NewerDataError(found);
    const localFields = await db.getMeta<number>(META_LOCAL_FIELDS);
    if (found === SCHEMA_VERSION && localFields === LOCAL_FIELDS_VERSION) return;
    for (const table of TABLES) {
      const t = db.tableFor(table);
      for (const record of await t.toArray()) {
        const upgraded = migrateRecord(table, stripLocal(record) as unknown as PlainRecord, found);
        if (upgraded) {
          await t.put(withLocalFields(table, upgraded as unknown as RecordTypes[typeof table]));
        } else if (isLedgerTable(table)) {
          throw new Error(
            `A migration tried to drop a ${table} record. Ledgers are never deleted.`,
          );
        } else {
          await t.delete(record.id);
        }
      }
    }
    await db.setMeta(META_SCHEMA, SCHEMA_VERSION);
    await db.setMeta(META_LOCAL_FIELDS, LOCAL_FIELDS_VERSION);
  });
}
