import { expect, test } from "vitest";
import type { DocumentLine } from "./schema";
import { documentTotals, lineTotals } from "./totals";

const line = (over: Partial<DocumentLine> = {}): DocumentLine => ({
  itemId: null,
  description: "Widget",
  quantity: 2000,
  unitPrice: 1250,
  discount: 0,
  taxRateId: "vat20",
  taxRate: 2000,
  ...over,
});

test("a line: quantity x price, less discount, plus tax", () => {
  expect(lineTotals(line({ discount: 1000 }))).toEqual({
    gross: 2500,
    discount: 250,
    net: 2250,
    tax: 450,
    total: 2700,
  });
});

test("tax is rounded per line, then summed", () => {
  // Three lines of 0.33 at 20%: each line's tax 0.066 rounds to 0.07, so 0.21, not 0.20.
  const lines = [1, 2, 3].map(() => line({ quantity: 1000, unitPrice: 33 }));
  const totals = documentTotals(lines);
  expect(totals.net).toBe(99);
  expect(totals.tax).toBe(21);
  expect(totals.total).toBe(120);
});

test("taxes are summarised per rate, in order of first use", () => {
  const totals = documentTotals([
    line({ taxRateId: "zero", taxRate: 0, unitPrice: 1000, quantity: 1000 }),
    line({ unitPrice: 1000, quantity: 1000 }),
    line({ taxRateId: "zero", taxRate: 0, unitPrice: 500, quantity: 1000 }),
  ]);
  expect(totals.taxes).toEqual([
    { taxRateId: "zero", rate: 0, net: 1500, tax: 0 },
    { taxRateId: "vat20", rate: 2000, net: 1000, tax: 200 },
  ]);
  expect(totals.total).toBe(2700);
});

test("an empty document totals zero", () => {
  expect(documentTotals([])).toEqual({ net: 0, discount: 0, tax: 0, total: 0, taxes: [] });
});
