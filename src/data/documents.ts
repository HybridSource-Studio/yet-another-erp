// Quotes, orders, invoices, credit notes, purchase orders and bills: one lifecycle for all.
//
//   draft  --confirm-->  confirmed  --cancel-->  cancelled
//
// A draft can be edited or deleted and posts nothing. Confirming numbers the document and, in
// the same transaction, writes its postings to the ledgers (posting.ts). A confirmed document is
// never edited: cancelling it writes reversing entries, and a corrected copy starts as a new draft.

import type { ErpDatabase } from "./db";
import { reverseJournalLines } from "./ledger";
import { canConfirm, POSTERS, type PostingContext } from "./posting";
import {
  NUMBER_PREFIX,
  type BasisPoints,
  type DocumentLine,
  type DocumentType,
  type Fields,
  type Id,
  type Item,
  type Milli,
  type Minor,
  type TradeDocument,
} from "./schema";
import type { Settings } from "./settings";
import {
  clean,
  cleanDate,
  live,
  liveList,
  requiredDate,
  todayIso,
  ValidationError,
} from "./shared";
import { documentTotals, type DocumentTotals } from "./totals";
import { NotFoundError, type Writer } from "./write";

export interface LineInput {
  itemId?: Id | null;
  description?: string;
  quantity: Milli;
  unitPrice: Minor;
  discount?: BasisPoints;
  taxRateId?: Id | null;
}

export interface DocumentInput {
  type: DocumentType;
  partyId: Id;
  issueDate: string;
  dueDate?: string | null;
  locationId?: Id | null;
  reference?: string;
  notes?: string;
  lines?: LineInput[];
  sourceId?: Id | null;
}

export type DraftPatch = Partial<Omit<DocumentInput, "type">>;

export class DocumentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentStateError";
  }
}

const NUMBER_DIGITS = 6;
const MAX_DISCOUNT: BasisPoints = 10_000;

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  quote: "Quote",
  salesOrder: "Sales order",
  invoice: "Invoice",
  creditNote: "Credit note",
  purchaseOrder: "Purchase order",
  bill: "Bill",
};

export class Documents {
  constructor(
    private readonly db: ErpDatabase,
    private readonly writer: Writer,
    private readonly settings: Settings,
  ) {}

  async createDraft(input: DocumentInput): Promise<TradeDocument> {
    return this.writer.transact(async () => {
      const fields = await this.clean(input);
      return this.writer.create("documents", { ...fields, status: "draft", number: null });
    });
  }

  async updateDraft(id: Id, patch: DraftPatch): Promise<TradeDocument> {
    return this.writer.transact(async () => {
      const current = await this.draft(id);
      // Lines are checked again only when they change, so editing the notes of an old draft
      // never fails over an item deleted since. Confirm checks every line regardless.
      const { lines, ...fields } = await this.clean({
        ...current,
        ...patch,
        type: current.type,
        lines: patch.lines ?? [],
      });
      return this.writer.update("documents", id, patch.lines ? { ...fields, lines } : fields);
    });
  }

  /** Deletes a draft. Confirmed documents are cancelled, never deleted. */
  async removeDraft(id: Id): Promise<void> {
    await this.writer.transact(async () => {
      await this.draft(id);
      await this.writer.remove("documents", id);
    });
  }

  async get(id: Id): Promise<TradeDocument | undefined> {
    return live(await this.db.documents.get(id));
  }

  /** Documents of a type, newest first. */
  async list(type: DocumentType): Promise<TradeDocument[]> {
    const all = liveList(await this.db.documents.where("type").equals(type).toArray());
    return all.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (a.id < b.id ? 1 : -1));
  }

  totals(doc: Pick<TradeDocument, "lines">): DocumentTotals {
    return documentTotals(doc.lines);
  }

  /**
   * Numbers a draft, freezes its tax rates, and writes its postings, all in one transaction:
   * either everything is written or nothing is.
   */
  async confirm(id: Id): Promise<TradeDocument> {
    return this.writer.transact(async () => {
      const draft = await this.draft(id);
      if (!canConfirm(draft.type)) {
        throw new DocumentStateError(
          `Confirming a ${DOCUMENT_LABEL[draft.type].toLowerCase()} isn't built yet.`,
        );
      }
      if (draft.lines.length === 0) throw new ValidationError("Add at least one line first.");
      const lines = await this.withCurrentRates(draft.lines);
      const number = await this.nextNumber(draft.type);
      const confirmed = await this.writer.update("documents", id, {
        status: "confirmed",
        number,
        lines,
      });
      const poster = POSTERS[confirmed.type];
      if (!poster) return confirmed;
      const posting = poster(confirmed, await this.postingContext(confirmed));
      const memo = `${DOCUMENT_LABEL[confirmed.type]} ${number}`;
      const source = { sourceType: "document" as const, sourceId: id, reversesId: null };
      if (posting.journal.length > 0) {
        await this.writer.append("journal", {
          date: confirmed.issueDate,
          memo,
          lines: posting.journal,
          ...source,
        });
      }
      for (const move of posting.stockMoves) {
        await this.writer.append("stockMoves", {
          ...move,
          date: confirmed.issueDate,
          memo,
          ...source,
        });
      }
      return confirmed;
    });
  }

  /** Cancels a confirmed document, reversing every ledger entry it posted. Dated today. */
  async cancel(id: Id): Promise<TradeDocument> {
    return this.writer.transact(async () => {
      const doc = await this.get(id);
      if (!doc) throw new NotFoundError("documents", id);
      if (doc.status !== "confirmed") {
        throw new DocumentStateError("Only a confirmed document can be cancelled.");
      }
      const date = todayIso();
      const memo = `Cancelled ${DOCUMENT_LABEL[doc.type].toLowerCase()} ${doc.number}`;
      const source = { sourceType: "document" as const, sourceId: id };
      const entries = await this.db.journal.where("sourceId").equals(id).toArray();
      for (const entry of entries.filter((e) => e.sourceType === "document" && !e.reversesId)) {
        const lines = reverseJournalLines(entry.lines);
        await this.writer.append("journal", { date, memo, lines, ...source, reversesId: entry.id });
      }
      const moves = await this.db.stockMoves.where("sourceId").equals(id).toArray();
      for (const move of moves.filter((m) => m.sourceType === "document" && !m.reversesId)) {
        await this.writer.append("stockMoves", {
          itemId: move.itemId,
          locationId: move.locationId,
          date,
          quantity: -move.quantity,
          unitCost: move.unitCost,
          memo,
          ...source,
          reversesId: move.id,
        });
      }
      return this.writer.update("documents", id, { status: "cancelled" });
    });
  }

  private async draft(id: Id): Promise<TradeDocument> {
    const doc = await this.get(id);
    if (!doc) throw new NotFoundError("documents", id);
    if (doc.status !== "draft") {
      throw new DocumentStateError("Only drafts can be changed. Cancel it and start a new one.");
    }
    return doc;
  }

  /**
   * The next number for a type: one more than the highest so far. Runs inside the confirming
   * transaction, so two tabs can't take the same number. Numbering across devices whose data is
   * later merged is an open question (docs/plan.md).
   */
  private async nextNumber(type: DocumentType): Promise<string> {
    const prefix = `${NUMBER_PREFIX[type]}-`;
    const docs = await this.db.documents.where("type").equals(type).toArray();
    const highest = docs.reduce((max, d) => {
      const n = d.number?.startsWith(prefix) ? Number(d.number.slice(prefix.length)) : 0;
      return Number.isSafeInteger(n) && n > max ? n : max;
    }, 0);
    return `${prefix}${String(highest + 1).padStart(NUMBER_DIGITS, "0")}`;
  }

  private async withCurrentRates(lines: DocumentLine[]): Promise<DocumentLine[]> {
    const out: DocumentLine[] = [];
    for (const line of lines) {
      const rate = line.taxRateId ? await this.settings.taxRate(line.taxRateId) : undefined;
      out.push({ ...line, taxRate: rate?.rate ?? line.taxRate });
    }
    return out;
  }

  private async postingContext(doc: TradeDocument): Promise<PostingContext> {
    const ids = [...new Set(doc.lines.flatMap((l) => (l.itemId ? [l.itemId] : [])))];
    const items = new Map<Id, Item>();
    for (const item of liveList(await this.db.items.bulkGet(ids))) items.set(item.id, item);
    const missing = ids.find((id) => !items.has(id));
    if (missing)
      throw new ValidationError("A line's item has been deleted. Change that line first.");
    return {
      accounts: await this.settings.accountMap(),
      items,
      locationId: doc.locationId ?? (await this.settings.defaultLocation()).id,
    };
  }

  private async clean(
    input: DocumentInput,
  ): Promise<Omit<Fields<"documents">, "status" | "number">> {
    if (!(input.type in NUMBER_PREFIX)) throw new ValidationError("Unknown document type.");
    if (!live(await this.db.parties.get(input.partyId))) {
      throw new ValidationError("Choose a customer or supplier.");
    }
    if (input.locationId && !live(await this.db.locations.get(input.locationId))) {
      throw new ValidationError("That location no longer exists.");
    }
    const lines: DocumentLine[] = [];
    for (const line of input.lines ?? []) lines.push(await this.cleanLine(line));
    return {
      type: input.type,
      partyId: input.partyId,
      issueDate: requiredDate(input.issueDate, "Date"),
      dueDate: cleanDate(input.dueDate, "Due date"),
      locationId: input.locationId ?? null,
      reference: clean(input.reference),
      notes: clean(input.notes),
      lines,
      sourceId: input.sourceId ?? null,
    };
  }

  private async cleanLine(line: LineInput): Promise<DocumentLine> {
    const item = line.itemId ? live(await this.db.items.get(line.itemId)) : undefined;
    if (line.itemId && !item) throw new ValidationError("A line's item no longer exists.");
    const tax = line.taxRateId ? await this.settings.taxRate(line.taxRateId) : undefined;
    if (line.taxRateId && !tax) throw new ValidationError("A line's tax rate no longer exists.");
    if (!Number.isSafeInteger(line.quantity) || line.quantity === 0) {
      throw new ValidationError("Each line needs a quantity.");
    }
    if (!Number.isSafeInteger(line.unitPrice)) throw new ValidationError("Check the unit prices.");
    const discount = line.discount ?? 0;
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > MAX_DISCOUNT) {
      throw new ValidationError("A discount is between 0% and 100%.");
    }
    const description = clean(line.description) || item?.name || "";
    if (!description) throw new ValidationError("Each line needs an item or a description.");
    return {
      itemId: item?.id ?? null,
      description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount,
      taxRateId: tax?.id ?? null,
      taxRate: tax?.rate ?? 0,
    };
  }
}
