// Record migrations. Each one turns a record of schema version N into version N + 1. The same
// functions will upgrade data already in the browser and older backup files, so a backup made by
// any past version can always be restored. Never delete a migration.

import { SCHEMA_VERSION, type TableName } from "./schema";

export type PlainRecord = Record<string, unknown>;

export interface Migration {
  /** The version this migration produces. It reads records of version `to - 1`. */
  to: number;
  /** Returns the upgraded record, or null to drop it. */
  up(table: TableName, record: PlainRecord): PlainRecord | null;
}

/** Schema 1 is the first; the first migration will be `{ to: 2, up(...) }`. */
export const MIGRATIONS: readonly Migration[] = [];

export class NewerDataError extends Error {
  constructor(readonly found: number) {
    super(
      `This data was saved by a newer version of the app (schema ${found}; this version reads up to ${SCHEMA_VERSION}). Reload to get the latest version.`,
    );
    this.name = "NewerDataError";
  }
}

/** Upgrades one record from `from` to `target`. Returns null if a migration dropped it. */
export function migrateRecord(
  table: TableName,
  record: PlainRecord,
  from: number,
  target: number = SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): PlainRecord | null {
  if (from > target) throw new NewerDataError(from);
  let current: PlainRecord | null = record;
  for (let version = from + 1; version <= target && current; version++) {
    const step = migrations.find((m) => m.to === version);
    if (!step) throw new Error(`No migration to schema version ${version}`);
    current = step.up(table, current);
  }
  return current;
}
