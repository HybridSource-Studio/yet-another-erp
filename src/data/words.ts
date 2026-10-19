// Search words and sort keys, derived on this device and kept in local-only fields.

import type { RecordTypes, TableName } from "./schema";

export const MIN_WORD_LENGTH = 2;

/** Lower-case words of a text, for prefix search. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= MIN_WORD_LENGTH);
}

function unique(texts: (string | null)[]): string[] {
  return [...new Set(texts.flatMap((t) => (t ? words(t) : [])))];
}

/** What a record can be found by, or null if its table isn't searched. */
export function wordsFor(table: TableName, record: RecordTypes[TableName]): string[] | null {
  switch (table) {
    case "parties": {
      const p = record as RecordTypes["parties"];
      return unique([p.name, p.email, p.taxId]);
    }
    case "items": {
      const i = record as RecordTypes["items"];
      return unique([i.sku, i.name]);
    }
    case "documents": {
      const d = record as RecordTypes["documents"];
      return unique([d.number, d.reference]);
    }
    default:
      return null;
  }
}

/** How a record sorts in lists, or null if its table isn't listed by name. */
export function sortKeyFor(table: TableName, record: RecordTypes[TableName]): string | null {
  switch (table) {
    case "parties":
    case "items":
    case "locations":
    case "taxRates":
      return (record as { name: string }).name.toLocaleLowerCase();
    case "accounts":
      return (record as RecordTypes["accounts"]).code;
    default:
      return null;
  }
}
