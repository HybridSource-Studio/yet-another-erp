// Field-by-field last-write-wins merge of two copies of one record.
//
// For each clocked field the copy with the later stamp wins. The result is the same whatever
// order copies arrive in and however often the same copy is applied, so devices converge
// without a server. Used by "restore and merge" (a backup from another device), and by any
// self-hosted sync added later. Ledger records are never edited, so they merge trivially.

import { clockedFields, type BaseRecord, type TableName } from "./schema";

export interface MergeResult<T> {
  merged: T;
  /** False when the incoming copy added nothing the local one did not already have. */
  changed: boolean;
}

export function mergeRecord<T extends BaseRecord>(
  table: TableName,
  local: T | undefined,
  incoming: T,
): MergeResult<T> {
  if (!local) return { merged: stripLocal(incoming), changed: true };
  if (local.id !== incoming.id) throw new Error("Cannot merge two different records");

  const merged = { ...stripLocal(local) } as unknown as Record<string, unknown>;
  const clocks: Record<string, string> = { ...local.fieldClocks };
  let changed = false;

  for (const field of clockedFields(table)) {
    const ours = local.fieldClocks[field] ?? "";
    const theirs = incoming.fieldClocks[field] ?? "";
    if (theirs > ours) {
      merged[field] = (incoming as unknown as Record<string, unknown>)[field];
      clocks[field] = theirs;
      changed = true;
    }
  }

  merged.fieldClocks = clocks;
  merged.createdAt = Math.min(local.createdAt, incoming.createdAt);
  merged.updatedAt = Math.max(local.updatedAt, incoming.updatedAt);
  if (merged.updatedAt !== local.updatedAt) changed = true;
  return { merged: merged as unknown as T, changed };
}

/** Drops local-only fields (names starting with "_"). */
export function stripLocal<T extends object>(record: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith("_")) out[key] = value;
  }
  return out as T;
}
