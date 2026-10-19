import { describe, expect, test } from "vitest";
import {
  allocate,
  AmountError,
  applyRate,
  currencyDigits,
  formatMoney,
  lineAmount,
  moneyInputValue,
  mulDiv,
  parseMoney,
  parseQuantity,
  parseRate,
} from "./money";

describe("mulDiv", () => {
  test("rounds half away from zero, both signs", () => {
    expect(mulDiv(5, 1, 10)).toBe(1); // 0.5 -> 1
    expect(mulDiv(-5, 1, 10)).toBe(-1); // -0.5 -> -1
    expect(mulDiv(4, 1, 10)).toBe(0);
    expect(mulDiv(-4, 1, 10)).toBe(0);
  });

  test("stays exact where floats would not", () => {
    // 0.1 + 0.2 style errors can't happen: 1.005 * 100 is 100.49999... as a float.
    expect(lineAmount(1005, 100)).toBe(101); // 1.005 units at 1.00 is 1.01 (half up)
    expect(mulDiv(2 ** 52, 3, 3)).toBe(2 ** 52);
  });

  test("refuses non-integers and results too large to store", () => {
    expect(() => mulDiv(1.5, 2, 1)).toThrow(AmountError);
    expect(() => mulDiv(Number.MAX_SAFE_INTEGER, 10, 1)).toThrow("too large");
    expect(() => mulDiv(1, 1, 0)).toThrow(AmountError);
  });
});

test("lineAmount and applyRate", () => {
  expect(lineAmount(1500, 1000)).toBe(1500); // 1.5 x 10.00 = 15.00
  expect(applyRate(1500, 2000)).toBe(300); // 20% of 15.00
  expect(applyRate(333, 2000)).toBe(67); // 66.6 -> 67
});

describe("allocate", () => {
  test("parts always add up to the total", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocate(1000, [500, 300, 200])).toEqual([500, 300, 200]);
    expect(allocate(5, [0, 0])).toEqual([3, 2]);
    expect(allocate(7, [])).toEqual([]);
  });

  test("gives leftovers to the largest remainders", () => {
    const parts = allocate(10, [3, 3, 4]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(parts).toEqual([3, 3, 4]);
    expect(allocate(1, [1, 2])).toEqual([0, 1]);
  });
});

describe("parsing", () => {
  test("money uses the currency's digits", () => {
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(parseMoney("12.5", "USD")).toBe(1250);
    expect(parseMoney("1,234.56", "USD")).toBe(123456);
    expect(parseMoney("-3", "USD")).toBe(-300);
    expect(parseMoney("1500", "JPY")).toBe(1500);
    expect(() => parseMoney("1.234", "USD")).toThrow("at most 2 decimal places");
    expect(() => parseMoney("abc", "USD")).toThrow(AmountError);
    expect(() => parseMoney("1.5", "JPY")).toThrow(AmountError);
    // A decimal comma is refused, never misread as a thousands separator.
    expect(() => parseMoney("12,50", "USD")).toThrow(AmountError);
    expect(() => parseMoney("1 2", "USD")).toThrow(AmountError);
    expect(parseMoney("12,345,678.90", "USD")).toBe(1234567890);
  });

  test("quantities have three decimals and rates two", () => {
    expect(parseQuantity("1.5")).toBe(1500);
    expect(parseQuantity("0.001")).toBe(1);
    expect(parseRate("20")).toBe(2000);
    expect(parseRate("7.5")).toBe(750);
    expect(parseQuantity("-0")).toBe(0);
  });

  test("an input value round-trips through parseMoney", () => {
    expect(moneyInputValue(123456, "USD")).toBe("1234.56");
    expect(parseMoney(moneyInputValue(123456, "USD"), "USD")).toBe(123456);
    expect(moneyInputValue(null, "USD")).toBe("");
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });
});
