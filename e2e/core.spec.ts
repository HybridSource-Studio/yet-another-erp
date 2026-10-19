import { expect, test } from "@playwright/test";

test("add a customer and an item, then find them in their lists", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Customers & suppliers" }).click();
  await page.getByRole("link", { name: "New customer or supplier" }).click();
  await page.getByLabel("Name").fill("Acme Ltd");
  await page.getByLabel("Email").fill("ap@acme.test");
  await page.getByLabel("Supplier").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "Acme Ltd" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Customer\s*Supplier/ })).toBeVisible();

  await page.getByRole("link", { name: "Items", exact: true }).click();
  await page.getByRole("link", { name: "New item" }).click();
  await page.getByLabel("Name").fill("Widget");
  await page.getByLabel("SKU").fill("W-1");
  await page.getByLabel(/Sale price/).fill("12.50");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "$12.50" })).toBeVisible();

  // It's all still there after a reload: stored in this browser.
  await page.reload();
  await expect(page.getByRole("cell", { name: "Widget" })).toBeVisible();
});

test("a bad value shows a message instead of saving", async ({ page }) => {
  await page.goto("./#/items/new");
  await page.getByLabel("Name").fill("Widget");
  await page.getByLabel(/Sale price/).fill("12.505");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toContainText("decimal places");
});

test("every module has a page", async ({ page }) => {
  await page.goto("./");
  for (const name of ["Invoices", "Bills", "Stock", "Chart of accounts", "Reports", "Your data"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await expect(page.getByRole("cell", { name: "Accounts receivable" })).toHaveCount(0);
  await page.getByRole("link", { name: "Chart of accounts" }).click();
  await expect(page.getByRole("cell", { name: "Accounts receivable" })).toBeVisible();
});

test("makes no requests to any other host", async ({ page }) => {
  const origin = new URL(page.url() === "about:blank" ? "http://localhost:5193" : page.url()).host;
  const elsewhere: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.host !== origin) elsewhere.push(request.url());
  });
  await page.goto("./");
  await page.getByRole("link", { name: "Items", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toBeVisible();
  expect(elsewhere).toEqual([]);
});
