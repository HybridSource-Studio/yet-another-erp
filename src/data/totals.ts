// Document totals, derived from the lines every time. Never stored, so they can't disagree with
// the lines. Tax is rounded per line, then summed: the common rule for small-business invoicing.
// Countries that round per document or per rate are a later setting (see docs/plan.md).

import { applyRate, lineAmount } from "./money";
import type { BasisPoints, DocumentLine, Id, Minor } from "./schema";

export interface LineTotals {
  /** Quantity times unit price. */
  gross: Minor;
  discount: Minor;
  /** After discount, before tax. */
  net: Minor;
  tax: Minor;
  total: Minor;
}

export type PricedLine = Pick<DocumentLine, "quantity" | "unitPrice" | "discount" | "taxRate">;

export function lineTotals(line: PricedLine): LineTotals {
  const gross = lineAmount(line.quantity, line.unitPrice);
  const discount = applyRate(gross, line.discount);
  const net = gross - discount;
  const tax = applyRate(net, line.taxRate);
  return { gross, discount, net, tax, total: net + tax };
}

export interface TaxSummary {
  taxRateId: Id | null;
  rate: BasisPoints;
  net: Minor;
  tax: Minor;
}

export interface DocumentTotals {
  net: Minor;
  discount: Minor;
  tax: Minor;
  total: Minor;
  /** One row per tax rate used, in order of first use: what a printed invoice lists. */
  taxes: TaxSummary[];
}

export function documentTotals(
  lines: readonly (PricedLine & Pick<DocumentLine, "taxRateId">)[],
): DocumentTotals {
  const taxes: TaxSummary[] = [];
  let net = 0;
  let discount = 0;
  let tax = 0;
  for (const line of lines) {
    const t = lineTotals(line);
    net += t.net;
    discount += t.discount;
    tax += t.tax;
    const index = taxes.findIndex((s) => s.taxRateId === line.taxRateId && s.rate === line.taxRate);
    const current = taxes[index];
    if (current) {
      taxes[index] = { ...current, net: current.net + t.net, tax: current.tax + t.tax };
    } else {
      taxes.push({ taxRateId: line.taxRateId, rate: line.taxRate, net: t.net, tax: t.tax });
    }
  }
  return { net, discount, tax, total: net + tax, taxes };
}
