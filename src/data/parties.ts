// Customers and suppliers. One record per business, flagged as either or both, so a business
// that buys from you and sells to you is entered once.

import type { ErpDatabase } from "./db";
import type { Fields, Id, Party } from "./schema";
import {
  byName,
  clean,
  cleanEmail,
  cleanInteger,
  live,
  liveList,
  required,
  ValidationError,
} from "./shared";
import { NotFoundError, type Writer } from "./write";

export interface PartyInput {
  name: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number | null;
  notes?: string;
}

export type PartyRole = "customer" | "supplier";

const MAX_TERMS_DAYS = 365;

function cleanParty(input: PartyInput): Fields<"parties"> {
  const isCustomer = input.isCustomer ?? !input.isSupplier;
  const isSupplier = input.isSupplier ?? false;
  if (!isCustomer && !isSupplier) {
    throw new ValidationError("Choose customer, supplier, or both.");
  }
  return {
    name: required(input.name, "Name"),
    isCustomer,
    isSupplier,
    email: cleanEmail(input.email),
    phone: clean(input.phone),
    address: clean(input.address),
    taxId: clean(input.taxId),
    paymentTermsDays: cleanInteger(input.paymentTermsDays, "Payment terms", {
      max: MAX_TERMS_DAYS,
    }),
    notes: clean(input.notes),
  };
}

export class Parties {
  constructor(
    private readonly db: ErpDatabase,
    private readonly writer: Writer,
  ) {}

  async create(input: PartyInput): Promise<Party> {
    return this.writer.create("parties", cleanParty(input));
  }

  async update(id: Id, patch: Partial<PartyInput>): Promise<Party> {
    return this.writer.transact(async () => {
      const current = await this.get(id);
      if (!current) throw new NotFoundError("parties", id);
      return this.writer.update("parties", id, cleanParty({ ...current, ...patch }));
    });
  }

  /** Deletes a party nothing refers to. One with documents or payments has a history to keep. */
  async remove(id: Id): Promise<void> {
    await this.writer.transact(async () => {
      const party = await this.get(id);
      if (!party) return;
      const isLive = (r: { deletedAt: number | null }) => r.deletedAt === null;
      const documents = await this.db.documents.where("partyId").equals(id).filter(isLive).count();
      const payments = await this.db.payments.where("partyId").equals(id).filter(isLive).count();
      if (documents + payments > 0) {
        throw new ValidationError(`${party.name} has documents or payments, so can't be deleted.`);
      }
      await this.writer.remove("parties", id);
    });
  }

  async get(id: Id): Promise<Party | undefined> {
    return live(await this.db.parties.get(id));
  }

  /** Parties by name, optionally only customers or only suppliers. */
  async list(role?: PartyRole): Promise<Party[]> {
    const all = liveList(await this.db.parties.orderBy("_sort").toArray());
    const filtered =
      role === "customer"
        ? all.filter((p) => p.isCustomer)
        : role === "supplier"
          ? all.filter((p) => p.isSupplier)
          : all;
    return filtered.sort(byName);
  }
}
