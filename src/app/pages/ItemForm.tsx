import { useState, type FormEvent } from "react";
import {
  formatQuantity,
  moneyInputValue,
  parseMoney,
  parseQuantity,
  type Item,
  type ItemKind,
} from "../../data";
import { Card } from "../components/Card";
import { ErrorMessage } from "../components/ErrorMessage";
import { errorMessage, formChecked, formText } from "../components/forms";
import { PageHeader } from "../components/PageHeader";
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
    <>
      <PageHeader
        title={item ? item.name : "New item"}
        description={item ? undefined : "A product you count, or a service you don't."}
      />
      <Card className="form-card">
        <form onSubmit={onSubmit}>
          <div className="form-section">
            <h2>Details</h2>
            <div className="fields">
              <label className="field span-2">
                Name
                <input name="name" required defaultValue={item?.name} />
              </label>
              <label className="field">
                SKU
                <input name="sku" defaultValue={item?.sku} className="mono" />
                <span className="field-help">Optional. Must be unique.</span>
              </label>
              <label className="field">
                Kind
                <select name="kind" defaultValue={item?.kind ?? "stock"}>
                  <option value="stock">Stock item (counted)</option>
                  <option value="service">Service (not counted)</option>
                </select>
              </label>
              <label className="field">
                Unit
                <input name="unit" placeholder="pcs" defaultValue={item?.unit} />
              </label>
              <label className="field">
                Reorder point
                <input
                  name="reorderPoint"
                  inputMode="decimal"
                  defaultValue={
                    item?.reorderPoint == null ? "" : formatQuantity(item.reorderPoint, "en-US")
                  }
                />
                <span className="field-help">Stock items only.</span>
              </label>
            </div>
          </div>
          <div className="form-section">
            <h2>Pricing</h2>
            <p className="subtle">In {currency}, the workspace currency.</p>
            <div className="fields">
              <label className="field">
                Sale price ({currency})
                <input
                  name="salePrice"
                  inputMode="decimal"
                  defaultValue={moneyInputValue(item?.salePrice ?? null, currency)}
                />
              </label>
              <label className="field">
                Cost price ({currency})
                <input
                  name="costPrice"
                  inputMode="decimal"
                  defaultValue={moneyInputValue(item?.costPrice ?? null, currency)}
                />
                <span className="field-help">
                  Used for cost of sales until stock costing arrives.
                </span>
              </label>
              <label className="field">
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
            </div>
          </div>
          {item && (
            <div className="form-section">
              <label className="field inline">
                <input type="checkbox" name="archived" defaultChecked={item.archived} />
                Archived (hidden from lists and pickers)
              </label>
            </div>
          )}
          <ErrorMessage message={error} />
          <div className="form-footer">
            <button type="submit" className="button button-primary">
              Save
            </button>
            <a href="#/items" className="button button-ghost">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </>
  );
}
