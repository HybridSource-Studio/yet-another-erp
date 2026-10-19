// Products and services: what you sell and buy. Stock on hand is never stored on the item; it is
// summed from the stock ledger.

import type { ErpDatabase } from "./db";
import { stockLevels, type StockLevel } from "./ledger";
import type { Fields, Id, Item, ItemKind, Milli, Minor } from "./schema";
import { byName, clean, cleanInteger, live, liveList, required, ValidationError } from "./shared";
import { NotFoundError, type Writer } from "./write";

export interface ItemInput {
  name: string;
  sku?: string;
  kind?: ItemKind;
  unit?: string;
  salePrice?: Minor | null;
  costPrice?: Minor | null;
  taxRateId?: Id | null;
  reorderPoint?: Milli | null;
  archived?: boolean;
}

const DEFAULT_UNIT = "pcs";

export class Items {
  constructor(
    private readonly db: ErpDatabase,
    private readonly writer: Writer,
  ) {}

  async create(input: ItemInput): Promise<Item> {
    return this.writer.transact(async () =>
      this.writer.create("items", await this.clean(input, null)),
    );
  }

  async update(id: Id, patch: Partial<ItemInput>): Promise<Item> {
    return this.writer.transact(async () => {
      const current = await this.get(id);
      if (!current) throw new NotFoundError("items", id);
      return this.writer.update("items", id, await this.clean({ ...current, ...patch }, id));
    });
  }

  /** Deletes an item that has never moved stock. One that has is archived instead. */
  async remove(id: Id): Promise<void> {
    await this.writer.transact(async () => {
      const item = await this.get(id);
      if (!item) return;
      if ((await this.db.stockMoves.where("itemId").equals(id).count()) > 0) {
        throw new ValidationError(`${item.name} has stock history, so archive it instead.`);
      }
      await this.writer.remove("items", id);
    });
  }

  async get(id: Id): Promise<Item | undefined> {
    return live(await this.db.items.get(id));
  }

  async list({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<Item[]> {
    const all = liveList(await this.db.items.orderBy("_sort").toArray());
    return (includeArchived ? all : all.filter((i) => !i.archived)).sort(byName);
  }

  /** Stock on hand of one item, per location. */
  async stock(id: Id): Promise<StockLevel[]> {
    return stockLevels(await this.db.stockMoves.where("itemId").equals(id).toArray());
  }

  /** Stock on hand of one item across all locations. */
  async onHand(id: Id): Promise<Milli> {
    return (await this.stock(id)).reduce((sum, level) => sum + level.quantity, 0);
  }

  private async clean(input: ItemInput, selfId: Id | null): Promise<Fields<"items">> {
    const kind: ItemKind = input.kind ?? "stock";
    if (kind !== "stock" && kind !== "service") throw new ValidationError("Unknown item kind.");
    if (selfId) {
      const before = await this.get(selfId);
      const moved = (await this.db.stockMoves.where("itemId").equals(selfId).count()) > 0;
      if (
        before &&
        moved &&
        (before.kind !== kind || before.unit !== (clean(input.unit) || DEFAULT_UNIT))
      ) {
        throw new ValidationError(
          `${before.name} has stock history, so its kind and unit can't change.`,
        );
      }
    }
    const sku = clean(input.sku);
    if (sku) await this.checkSkuFree(sku, selfId);
    const taxRateId = input.taxRateId ?? null;
    if (taxRateId && !live(await this.db.taxRates.get(taxRateId))) {
      throw new ValidationError("That tax rate no longer exists.");
    }
    return {
      sku,
      name: required(input.name, "Name"),
      kind,
      unit: clean(input.unit) || DEFAULT_UNIT,
      salePrice: cleanInteger(input.salePrice, "Sale price"),
      costPrice: cleanInteger(input.costPrice, "Cost price"),
      taxRateId,
      // Services aren't counted, so they have no reorder point.
      reorderPoint: kind === "stock" ? cleanInteger(input.reorderPoint, "Reorder point") : null,
      archived: input.archived ?? false,
    };
  }

  private async checkSkuFree(sku: string, selfId: Id | null): Promise<void> {
    const clash = liveList(await this.db.items.where("sku").equalsIgnoreCase(sku).toArray()).find(
      (i) => i.id !== selfId,
    );
    if (clash) throw new ValidationError(`SKU ${sku} is already used by ${clash.name}.`);
  }
}
