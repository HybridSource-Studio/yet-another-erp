// The single write path. Every change to a stored record goes through here: this is where clock
// stamps are set, local index fields derived, the change count kept for backup reminders, and
// the ledger rules enforced (append only; journal entries must balance). A self-hosted sync, if
// one is ever added, hooks in here too.

import Dexie from "dexie";
import type { ErpDatabase } from "./db";
import type { Clock, ClockState } from "./hlc";
import { uuidv7 } from "./ids";
import { checkJournalLines, checkStockMove, LedgerError } from "./ledger";
import { stripLocal } from "./merge";
import { META_CHANGES, META_CLOCK } from "./meta";
import {
  clockedFields,
  FIELDS,
  isLedgerTable,
  type Fields,
  type Id,
  type LedgerTable,
  type RecordTypes,
  type Stamp,
  type Stored,
  type TableName,
} from "./schema";
import { sortKeyFor, wordsFor } from "./words";

/**
 * Bump when withLocalFields derives anything differently (search words, sort keys). Every
 * stored record is then re-derived the next time the app opens, so indexes never go stale.
 */
export const LOCAL_FIELDS_VERSION = 1;

export class NotFoundError extends Error {
  constructor(table: TableName, id: Id) {
    super(`No ${table} record with id ${id}`);
    this.name = "RecordNotFoundError";
  }
}

/** Adds the local-only index fields. Deleted records get none, so they leave the indexes. */
export function withLocalFields<T extends TableName>(table: T, record: RecordTypes[T]): Stored<T> {
  const stored = { ...stripLocal(record) } as Stored<T>;
  if (record.deletedAt === null) {
    const words = wordsFor(table, record);
    if (words) stored._words = words;
    const sort = sortKeyFor(table, record);
    if (sort !== null) stored._sort = sort;
  }
  return stored;
}

function unwrap(error: unknown): unknown {
  const inner = (error as { inner?: unknown } | null)?.inner;
  return error instanceof Dexie.DexieError && inner instanceof Error ? unwrap(inner) : error;
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function refuseLedger(table: TableName, action: string): void {
  if (isLedgerTable(table)) {
    throw new LedgerError(`Ledger records are never ${action}; write a reversing entry instead.`);
  }
}

export class Writer {
  constructor(
    private readonly db: ErpDatabase,
    private readonly clock: Clock,
    private readonly workspaceId: Id,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Runs `fn` in one read-write transaction over every table. Writes are serialised across
   * tabs, and the clock is advanced past whatever another tab saved, so stamps stay unique.
   * Calls nest: a repository method that writes can run inside another's transaction.
   */
  async transact<R>(fn: (tick: () => Stamp) => Promise<R>): Promise<R> {
    const db = this.db;
    // Dexie wraps an error thrown inside a transaction in its own error type. Unwrap it, so callers
    // get the ValidationError (or other error) a repository threw, with its own message.
    return db
      .transaction("rw", db.tables, async () => {
        const saved = await db.getMeta<ClockState>(META_CLOCK);
        if (saved) this.clock.advanceTo(saved);
        let writes = 0;
        const result = await fn(() => {
          writes += 1;
          return this.clock.tick();
        });
        if (writes > 0) {
          await db.setMeta(META_CLOCK, this.clock.state);
          const changes = (await db.getMeta<number>(META_CHANGES)) ?? 0;
          await db.setMeta(META_CHANGES, changes + writes);
        }
        return result;
      })
      .catch((error: unknown) => {
        throw unwrap(error);
      });
  }

  /** Builds a new record with every field stamped. Call inside transact(). */
  build<T extends TableName>(table: T, fields: Fields<T>, stamp: Stamp): RecordTypes[T] {
    const now = this.now();
    const fieldClocks: Record<string, Stamp> = {};
    for (const field of clockedFields(table)) fieldClocks[field] = stamp;
    return {
      ...fields,
      id: uuidv7(now),
      workspaceId: this.workspaceId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      fieldClocks,
    } as RecordTypes[T];
  }

  async create<T extends TableName>(table: T, fields: Fields<T>): Promise<RecordTypes[T]> {
    refuseLedger(table, "created with create()");
    return this.transact(async (tick) => {
      const record = this.build(table, fields, tick());
      await this.db.tableFor(table).add(withLocalFields(table, record));
      return record;
    });
  }

  /** Adds a ledger record. A journal entry must balance or nothing is written. */
  async append<T extends LedgerTable>(table: T, fields: Fields<T>): Promise<RecordTypes[T]> {
    if (table === "journal") checkJournalLines((fields as unknown as Fields<"journal">).lines);
    else checkStockMove(fields as unknown as Fields<"stockMoves">);
    return this.transact(async (tick) => {
      const record = this.build(table, fields, tick());
      await this.db.tableFor(table).add(withLocalFields(table, record));
      return record;
    });
  }

  /** Changes the given fields. Only fields whose value actually changes get a new stamp. */
  async update<T extends TableName>(
    table: T,
    id: Id,
    patch: Partial<Fields<T>>,
  ): Promise<RecordTypes[T]> {
    refuseLedger(table, "edited");
    return this.transact(async (tick) => {
      const current = await this.db.tableFor(table).get(id);
      if (!current || current.deletedAt !== null) throw new NotFoundError(table, id);
      const allowed: readonly string[] = FIELDS[table];
      const record = current as unknown as Record<string, unknown>;
      const changes = Object.entries(patch).filter(
        ([field, value]) =>
          value !== undefined && allowed.includes(field) && !sameValue(record[field], value),
      );
      if (changes.length === 0) return stripLocal(current) as RecordTypes[T];
      const stamp = tick();
      const next = {
        ...stripLocal(current),
        ...Object.fromEntries(changes),
        updatedAt: this.now(),
        fieldClocks: {
          ...current.fieldClocks,
          ...Object.fromEntries(changes.map(([field]) => [field, stamp])),
        },
      } as RecordTypes[T];
      await this.db.tableFor(table).put(withLocalFields(table, next));
      return next;
    });
  }

  /**
   * Marks a record deleted. It stays in the database as a tombstone so the delete merges like
   * any other edit. Repositories decide what may be deleted; ledger records never are.
   */
  async remove(table: TableName, id: Id): Promise<void> {
    refuseLedger(table, "deleted");
    await this.transact(async (tick) => {
      const current = await this.db.tableFor(table).get(id);
      if (!current || current.deletedAt !== null) return;
      const now = this.now();
      const next = {
        ...stripLocal(current),
        deletedAt: now,
        updatedAt: now,
        fieldClocks: { ...current.fieldClocks, deletedAt: tick() },
      } as RecordTypes[typeof table];
      await this.db.tableFor(table).put(withLocalFields(table, next));
    });
  }
}
