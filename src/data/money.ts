// Money, quantities and rates are integers: minor units (cents), thousandths of a unit, and basis
// points. Floats never touch a stored amount. Products are computed exactly with BigInt and
// rounded half away from zero, the rule most tax authorities and accountants expect.

import type { BasisPoints, Milli, Minor } from "./schema";

export const MILLI_PER_UNIT = 1000;
export const BASIS_POINTS_PER_WHOLE = 10_000;
/** Decimal places a quantity can have. */
export const QUANTITY_DIGITS = 3;

export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountError";
  }
}

function assertInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) throw new AmountError(`${what} must be a whole number.`);
}

/** a * b / d, exactly, rounded half away from zero. Throws if the result is not a safe integer. */
export function mulDiv(a: number, b: number, d: number): number {
  assertInteger(a, "Amount");
  assertInteger(b, "Amount");
  assertInteger(d, "Divisor");
  if (d <= 0) throw new AmountError("Divisor must be positive.");
  const product = BigInt(a) * BigInt(b);
  const divisor = BigInt(d);
  const negative = product < 0n;
  const abs = negative ? -product : product;
  let quotient = abs / divisor;
  if ((abs % divisor) * 2n >= divisor) quotient += 1n;
  const result = Number(negative ? -quotient : quotient);
  if (!Number.isSafeInteger(result)) throw new AmountError("Amount is too large.");
  return result === 0 ? 0 : result;
}

/** The amount for a quantity at a unit price: 1.5 units at 10.00 is 15.00. */
export function lineAmount(quantity: Milli, unitPrice: Minor): Minor {
  return mulDiv(quantity, unitPrice, MILLI_PER_UNIT);
}

/** A rate applied to an amount: 20% of 15.00 is 3.00. */
export function applyRate(amount: Minor, rate: BasisPoints): Minor {
  return mulDiv(amount, rate, BASIS_POINTS_PER_WHOLE);
}

/**
 * Splits a total into parts in proportion to weights, so that the parts add up to the total
 * exactly (largest remainder method; ties go to the earlier part). Equal weights if all are 0.
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  assertInteger(total, "Total");
  if (weights.length === 0) return [];
  for (const w of weights) {
    assertInteger(w, "Weight");
    if (w < 0) throw new AmountError("Weights cannot be negative.");
  }
  const effective = weights.every((w) => w === 0) ? weights.map(() => 1) : weights;
  const sum = effective.reduce((a, b) => a + BigInt(b), 0n);
  const sign = total < 0 ? -1n : 1n;
  const abs = BigInt(Math.abs(total));
  const parts = effective.map((w) => (abs * BigInt(w)) / sum);
  const order = effective
    .map((w, i) => ({ i, r: (abs * BigInt(w)) % sum }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  let left = abs - parts.reduce((a, b) => a + b, 0n);
  for (const { i } of order) {
    if (left === 0n) break;
    parts[i] = parts[i]! + 1n;
    left -= 1n;
  }
  return parts.map((p) => Number(p * sign));
}

/** Minor-unit digits of a currency: 2 for USD, 0 for JPY, 3 for KWD. */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/**
 * Reads a decimal typed by a person ("1,234.50") as an integer with `digits` implied decimals.
 * A comma is accepted only as a thousands separator in whole groups of three, so a decimal comma
 * ("12,50") is refused rather than misread as 1250. Locale-aware input is a later step.
 */
export function parseDecimal(text: string, digits: number, what: string): number {
  const match = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new AmountError(`${what} should be a number like 12.50.`);
  const [, sign, grouped, fraction = ""] = match;
  const whole = grouped!.replace(/,/g, "");
  if (fraction.length > digits) {
    throw new AmountError(`${what} can have at most ${digits} decimal places.`);
  }
  const scaled = BigInt(whole + fraction.padEnd(digits, "0"));
  const result = Number(sign ? -scaled : scaled);
  if (!Number.isSafeInteger(result)) throw new AmountError(`${what} is too large.`);
  return result === 0 ? 0 : result;
}

export function parseMoney(text: string, currency: string): Minor {
  return parseDecimal(text, currencyDigits(currency), "Amount");
}

export function parseQuantity(text: string): Milli {
  return parseDecimal(text, QUANTITY_DIGITS, "Quantity");
}

/** A rate typed as a percentage ("20", "7.5") in basis points. */
export function parseRate(text: string): BasisPoints {
  return parseDecimal(text, 2, "Rate");
}

/** For display only: the division here never feeds back into a stored amount. */
export function formatMoney(amount: Minor, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount / 10 ** currencyDigits(currency),
  );
}

/** A minor-unit amount as a plain decimal for an input field: 1234 USD is "12.34". */
export function moneyInputValue(amount: Minor | null, currency: string): string {
  if (amount === null) return "";
  const digits = currencyDigits(currency);
  return (amount / 10 ** digits).toFixed(digits);
}

export function formatQuantity(quantity: Milli, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: QUANTITY_DIGITS }).format(
    quantity / MILLI_PER_UNIT,
  );
}

export function formatRate(rate: BasisPoints, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(
    rate / BASIS_POINTS_PER_WHOLE,
  );
}
