import { describe, expect, test } from "vitest";
import {
  accountBalances,
  checkJournalLines,
  combineJournalLines,
  LedgerError,
  reverseJournalLines,
  signedLine,
  stockLevels,
} from "./ledger";

describe("checkJournalLines", () => {
  test("accepts a balanced entry", () => {
    expect(() =>
      checkJournalLines([signedLine("cash", 500), signedLine("sales", -500)]),
    ).not.toThrow();
  });

  test.each([
    ["one line", [signedLine("cash", 500)]],
    ["unbalanced", [signedLine("cash", 500), signedLine("sales", -400)]],
    ["both sides on a line", [{ accountId: "a", debit: 1, credit: 1 }, signedLine("b", 0)]],
    ["negative", [{ accountId: "a", debit: -5, credit: 0 }, signedLine("b", -5)]],
    ["fractional", [signedLine("a", 0.5), signedLine("b", -0.5)]],
  ])("refuses %s", (_name, lines) => {
    expect(() => checkJournalLines(lines)).toThrow(LedgerError);
  });
});

test("combining nets per account and drops zeros", () => {
  const combined = combineJournalLines([
    signedLine("ar", 1200),
    signedLine("sales", -1000),
    signedLine("tax", -200),
    signedLine("cogs", 0),
    signedLine("ar", -200),
  ]);
  expect(combined).toEqual([
    signedLine("ar", 1000),
    signedLine("sales", -1000),
    signedLine("tax", -200),
  ]);
});

test("a reversal undoes the entry", () => {
  const lines = [signedLine("cash", 500), signedLine("sales", -500)];
  const balances = accountBalances([{ lines }, { lines: reverseJournalLines(lines) }]);
  for (const b of balances.values()) expect(b.debit - b.credit).toBe(0);
});

test("stock levels sum moves per item and location", () => {
  const levels = stockLevels([
    { itemId: "a", locationId: "x", quantity: 5000 },
    { itemId: "a", locationId: "x", quantity: -2000 },
    { itemId: "a", locationId: "y", quantity: 1000 },
    { itemId: "b", locationId: "x", quantity: 1000 },
    { itemId: "b", locationId: "x", quantity: -1000 },
  ]);
  expect(levels).toEqual([
    { itemId: "a", locationId: "x", quantity: 3000 },
    { itemId: "a", locationId: "y", quantity: 1000 },
  ]);
});
