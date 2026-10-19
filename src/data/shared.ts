// Shared by the repositories: input cleaning and validation, and the read helpers that keep
// deleted records and local-only fields out of everything the UI sees.

import { stripLocal } from "./merge";
import type { IsoDate } from "./schema";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ---------- Input cleaning ----------

export function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function required(value: string | null | undefined, what: string): string {
  const v = clean(value);
  if (!v) throw new ValidationError(`${what} is required.`);
  return v;
}

export function cleanDate(value: string | null | undefined, what: string): IsoDate | null {
  const v = clean(value);
  if (!v) return null;
  // Round-trip through UTC so impossible dates such as 2026-02-31 are refused, not rolled over.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v) {
    throw new ValidationError(`${what} must be a date like 2026-10-05.`);
  }
  return v;
}

export function requiredDate(value: string | null | undefined, what: string): IsoDate {
  const v = cleanDate(value, what);
  if (!v) throw new ValidationError(`${what} is required.`);
  return v;
}

export function cleanEmail(value: string | null | undefined): string {
  const v = clean(value);
  if (v && !/^[^\s@]+@[^\s@]+$/.test(v)) {
    throw new ValidationError("Email should look like name@example.com.");
  }
  return v;
}

/** A whole number in a range, or null when empty. */
export function cleanInteger(
  value: number | null | undefined,
  what: string,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ValidationError(`${what} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** Today's date on this device, as "YYYY-MM-DD". */
export function todayIso(now: number = Date.now()): IsoDate {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- Shared reads ----------

export function live<T extends { deletedAt: number | null }>(record: T | undefined): T | undefined {
  return record && record.deletedAt === null ? stripLocal(record) : undefined;
}

export function liveList<T extends { deletedAt: number | null }>(records: (T | undefined)[]): T[] {
  return records.filter((r): r is T => !!r && r.deletedAt === null).map((r) => stripLocal(r));
}

export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
