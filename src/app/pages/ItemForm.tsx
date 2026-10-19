import { useState, type FormEvent } from "react";
import {
  formatQuantity,
  moneyInputValue,
  parseMoney,
  parseQuantity,
  type Item,
  type ItemKind,
} from "../../data";
import { ErrorMessage } from "../components/ErrorMessage";
import { errorMessage, formChecked, formText } from "../components/forms";
import { navigate } from "../router";
import { useLive, useStore } from "../store-context";
import { NotFound } from "./NotFound";

export function ItemPage({ id }: { id: string }) {
  const item = useLive(async (s) => (await s.items.get(id)) ?? null, [id]);
  if (item === undefined) return null;
  if (item === null) return <NotFound />;
  return <ItemForm item={item} />;
}

export function ItemForm({ item }: { item?: Item }) {
  const store = useStore();
  const options = useLive(async (s) => {
    const [taxRates, workspace] = await Promise.all([s.settings.taxRates(), s.workspace()]);
    return { taxRates, currency: workspace.currency };
  }, []);
  const [error, setError] = useState<string | null>(null);
  if (!options) return null;
  const { currency, taxRates } = options;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const money = (name: string) => {
      const text = formText(form, name);
      return text === "" ? null : parseMoney(text, currency);
    };
    try {
      const reorder = formText(form, "reorderPoint");
      const input = {
        name: formText(form, "name"),
        sku: formText(form, "sku"),
        kind: formText(form, "kind") as ItemKind,
        unit: formText(form, "unit"),
        salePrice: money("salePrice"),
        costPrice: money("costPrice"),
        taxRateId: formText(form, "taxRateId") || null,
        reorderPoint: reorder === "" ? null : parseQuantity(reorder),
        archived: formChecked(form, "archived"),
      };
      if (item) await store.items.update(item.id, input);
      else await store.items.create(input);
      navigate("/items");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <section>
      <h1>{item ? item.name : "New item"}</h1>
      <form onSubmit={onSubmit} className="stacked">
        <label>
          Name
          <input name="name" required defaultValue={item?.name} />
        </label>
        <label>
          SKU
          <input name="sku" defaultValue={item?.sku} />
        </label>
        <label>
          Kind
          <select name="kind" defaultValue={item?.kind ?? "stock"}>
            <option value="stock">Stock item (counted)</option>
            <option value="service">Service (not counted)</option>
          </select>
        </label>
        <label>
          Unit
          <input name="unit" placeholder="pcs" defaultValue={item?.unit} />
        </label>
        <label>
          Sale price ({currency})
          <input
            name="salePrice"
            inputMode="decimal"
            defaultValue={moneyInputValue(item?.salePrice ?? null, currency)}
          />
        </label>
        <label>
          Cost price ({currency})
          <input
            name="costPrice"
            inputMode="decimal"
            defaultValue={moneyInputValue(item?.costPrice ?? null, currency)}
          />
        </label>
        <label>
          Tax rate
          <select name="taxRateId" defaultValue={item?.taxRateId ?? ""}>
            <option value="">None</option>
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reorder point
          <input
            name="reorderPoint"
            inputMode="decimal"
            defaultValue={
              item?.reorderPoint == null ? "" : formatQuantity(item.reorderPoint, "en-US")
            }
          />
        </label>
        {item && (
          <label className="inline">
            <input type="checkbox" name="archived" defaultChecked={item.archived} />
            Archived (hidden from lists)
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="actions">
          <button type="submit">Save</button>
          <a href="#/items">Cancel</a>
        </div>
      </form>
    </section>
  );
}
